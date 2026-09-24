# Gwiazdki

A family motivation system: children earn stars for completing daily routines, a parent approves them, and stars convert to a money reward at the end of a contract period.

## Language

**Star**:
The unit of reward a child earns for a completed, approved task. Shown to children as "gwiazdka".
_Avoid_: gwiazdka (in code and docs), гвязка, звезда, point, coin

**Join code**:
A short single-use code the parent issues so a child can sign in on their own device, entered inside the installed app.
_Avoid_: join link, invite link, token

**School day**:
Any Monday to Friday, the only days on which Tasks can earn Stars, with no exceptions for holidays or sickness.
_Avoid_: counting day, weekday

**Task**:
A recurring daily routine on one child's own list, the same on every School day, worth one Star when approved.
_Avoid_: chore, habit, duty

**Weekly bonus**:
Extra Stars the parent grants a child by hand, at most once per week, after judging that week. Its size is fixed by the Contract; it is never computed automatically.
_Avoid_: streak, weekly reward

**Contract**:
One child's agreement for a period with a start and end date, a fixed PLN value per Star and a fixed Weekly bonus size. A child has at most one open Contract, and Stars are earned only inside one.
_Avoid_: semester, period, agreement

**Payout**:
The single act that closes a Contract and pays its whole Star balance at the Contract's rate; after it the Contract is frozen and the next one starts from zero.
_Avoid_: cash-out, withdrawal, settlement
