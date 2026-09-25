# Gwiazdki

A family motivation system: children earn stars for completing daily routines, a parent approves them, and stars convert to a money reward at the end of a contract period.

## Language

**Star**:
The unit of reward a child earns for a completed, approved task. Shown in the app as "gwiazdka", the one Polish word on its otherwise English screens.
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

**Check-off**:
A child's claim that they did one Task on one School day. It waits for the parent's Approval and never expires; the child can make or undo it until 22:00 the next calendar day, unless the parent has already decided on it.
_Avoid_: tick, submit, mark done

**Approval**:
The parent's decision on one Task on one School day: approved earns one Star, rejected earns none and shows the child it was not counted. Either way the child can no longer change that Task. The parent can approve a Task that has no Check-off, and can change any decision while the Contract is open.
_Avoid_: accept, confirm, review

**Weekly bonus**:
Extra Stars the parent grants a child by hand, at most once per week, after judging that week. Its size is set by the Contract; it is never computed automatically.
_Avoid_: streak, weekly reward

**Contract**:
One child's agreement for a period with a start and end date, a PLN value per Star and a Weekly bonus size. The parent can change the rate and bonus size while the Contract is open, and the current rate counts for all of its Stars. A child has at most one open Contract, and Stars are earned only inside one.
_Avoid_: semester, period, agreement

**Payout**:
The single act that closes a Contract and pays its whole Star balance at the Contract's rate; after it the Contract is frozen and the next one starts from zero.
_Avoid_: cash-out, withdrawal, settlement
