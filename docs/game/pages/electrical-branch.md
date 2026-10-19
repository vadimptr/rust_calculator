---
id: electrical-branch
title: Ветвитель
kind: object
group: Электричество
icon: electrical.branch
summary: Ветвитель (Electrical Branch) отдаёт на «Branch Out» фиксированную мощность branchAmount (1…10 000 000, по умолчанию 2), а остаток — на «Power Out»; сам ничего не потребляет.
related: [electricity, splitter, battery, electricity-quirks]
code: [ElectricalBranch.cs]
---

## Кратко

Ветвитель (`ElectricalBranch`, префаб `electrical.branch.deployed`, предмет
`electrical.branch`) отрезает от входа заданное количество rW на выход «Branch Out», а всё
остальное пускает дальше на «Power Out». Потребление 0.

## Характеристики

| Параметр | Значение | Источник |
|---|---|---|
| Входы | «Power In» (основной) | префаб |
| Выходы | 0 — «Power Out», 1 — «Branch Out» | префаб |
| `branchAmount` | 2 по умолчанию, допустимо 1…10 000 000 | префаб; `SetBranchOffPower` |
| Потребление | 0 | `ConsumptionAmount` |
| Кто настраивает | игрок с правом строительства, не чаще 5 раз/с, с 3 м | `RPC_SetBranchOffPower` |
| HP | 200 | префаб |

## Поведение

```
Branch Out (1) = min(вход, branchAmount)
Power Out  (0) = max(вход − branchAmount, 0)
```

Сначала заполняется ветка, потом основной выход. При входе 7 и `branchAmount` = 10 ветка
получит 7, основной выход — 0.

`AllowDrainFrom` = true для обоих выходов: батарея выше видит потребителей на обеих ветках.
`branchAmount` сохраняется в `genericInt1`.

## Нюансы

- **Не делит по числу подключённых выходов.** Если «Power Out» никуда не подключён, остаток
  просто пропадает.
- **Нельзя выставить 0.** Минимум 1.
- Ветвитель не корневое устройство, и его провод не примет [[combiner|сумматор]].
- Расход батареи определяется потребителями, а не настройкой ветвителя.

## На практике

- Цепочка «ветвитель на 10 → турель, остаток → следующий ветвитель на 10 → турель…» отдаёт
  каждой турели ровно её потребление. Это надёжнее [[splitter|сплиттера]], который делит
  поровну.
- Ветку с большим `branchAmount` ставьте на самое важное: она наполняется первой.

## Где в коде

`ElectricalBranch.GetPassthroughAmount`, `SetBranchOffPower`, `RPC_SetBranchOffPower`, `AllowDrainFrom`.
