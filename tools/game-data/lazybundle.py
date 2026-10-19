"""Load UnityFS bundles without decompressing them into memory: blocks are inflated on demand, a few at a time."""
import bisect
import io
from collections import OrderedDict

import UnityPy
from UnityPy.enums import ArchiveFlags
from UnityPy.files import BundleFile
from UnityPy.files.BundleFile import BlockInfo, DirectoryInfoFS
from UnityPy.helpers import ImportHelper
from UnityPy.streams import EndianBinaryReader

CACHE_BLOCKS = 64


class BlockStore:
    def __init__(self, path, data_start, blocks, decompress):
        self.f = open(path, 'rb')
        self.blocks = blocks
        self.decompress = decompress
        self.c_off, self.u_off = [], []
        c = data_start
        u = 0
        for b in blocks:
            self.c_off.append(c)
            self.u_off.append(u)
            c += b.compressedSize
            u += b.uncompressedSize
        self.size = u
        self.cache = OrderedDict()

    def block(self, i):
        data = self.cache.get(i)
        if data is None:
            b = self.blocks[i]
            self.f.seek(self.c_off[i])
            data = self.decompress(self.f.read(b.compressedSize), b.uncompressedSize, b.flags, i)
            self.cache[i] = data
            if len(self.cache) > CACHE_BLOCKS:
                self.cache.popitem(last=False)
        else:
            self.cache.move_to_end(i)
        return data

    def read(self, pos, size):
        out = bytearray()
        while size > 0 and pos < self.size:
            i = bisect.bisect_right(self.u_off, pos) - 1
            start = pos - self.u_off[i]
            if self.blocks[i].flags & 0x3f == 0:
                self.f.seek(self.c_off[i] + start)
                chunk = self.f.read(min(size, self.blocks[i].uncompressedSize - start))
            else:
                chunk = self.block(i)[start:start + size]
            out += chunk
            pos += len(chunk)
            size -= len(chunk)
        return bytes(out)


class NodeStream(io.RawIOBase):
    def __init__(self, store, offset, size):
        self.store, self.offset, self.length, self.pos = store, offset, size, 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, pos, whence=0):
        self.pos = pos if whence == 0 else self.pos + pos if whence == 1 else self.length + pos
        return self.pos

    def readinto(self, buf):
        n = max(0, min(len(buf), self.length - self.pos))
        data = self.store.read(self.offset + self.pos, n)
        buf[:len(data)] = data
        self.pos += len(data)
        return len(data)


class LazyBundle(BundleFile):
    def read_fs(self, reader):
        size = reader.read_long()
        compressed = reader.read_u_int()
        uncompressed = reader.read_u_int()
        self.dataflags = ArchiveFlags(reader.read_u_int())
        if self.version >= 7:
            reader.align_stream(16)
            self._uses_block_alignment = True
        start = reader.Position
        if self.dataflags & ArchiveFlags.BlocksInfoAtTheEnd:
            reader.Position = size - compressed
            info = reader.read_bytes(compressed)
            reader.Position = start
        else:
            info = reader.read_bytes(compressed)
        info = EndianBinaryReader(self.decompress_data(info, uncompressed, self.dataflags))
        info.read_bytes(16)
        blocks = [BlockInfo(info.read_u_int(), info.read_u_int(), info.read_u_short()) for _ in range(info.read_int())]
        nodes = [DirectoryInfoFS(info.read_long(), info.read_long(), info.read_u_int(), info.read_string_to_null())
                 for _ in range(info.read_int())]
        if self.dataflags & ArchiveFlags.BlockInfoNeedPaddingAtStart:
            reader.align_stream(16)
        if blocks:
            self._block_info_flags = blocks[0].flags
        return nodes, BlockStore(reader.stream.name, reader.Position, blocks, self.decompress_data)

    def read_files(self, store, nodes):
        for node in nodes:
            stream = io.BufferedReader(NodeStream(store, node.offset, node.size), 1 << 16)
            node_reader = EndianBinaryReader(stream)
            f = ImportHelper.parse_file(node_reader, self, node.path, is_dependency=self.is_dependency)
            if self.environment:
                self.environment.register_cab(node.path, f)
            f.flags = node.flags
            self.files[node.path] = f


def load(*paths):
    env = UnityPy.Environment()
    for path in paths:
        reader = EndianBinaryReader(open(path, 'rb'))
        env.files[path] = LazyBundle(reader, env, name=path)
    return env
