# ReFillr

Shared household stock: each household knows what it has at home and how much it is short of its monthly
usage, so shopping is just picking up the missing units. The term in bold is the one code uses; "UI" is
the Spanish word the person sees.

## People and access

**Household** (UI: hogar):
The group of people who share one stock. Items belong to the household, never to a person.
_Avoid_: home, family, group

**Member** (UI: miembro):
A person who belongs to a household. Each person is a member of exactly one household.
_Avoid_: user (when talking about a household), participant

**Admin** (UI: administrador):
The one person who creates accounts and sets up households. No member can remove the admin from a household.
_Avoid_: owner, household admin

## Stock

**Item** (UI: ítem):
Something the household uses up and buys again, with its category, unit, monthly usage and quantity on hand.
_Avoid_: product, article

**Category** (UI: categoría):
The group an item is listed under. Every household has the three base categories (Despensa, Baño, Limpieza)
and may add its own.
_Avoid_: section, aisle

**Unit** (UI: unidad):
How an item is counted (rolls, cartons, packs). Free text; never converted between units.
_Avoid_: measure

**Monthly usage** (UI: consumo mensual):
How many units of an item the household uses in a month; the level a purchase brings it back to.
_Avoid_: target stock, minimum

**Current quantity** (UI: en casa):
How many units of an item are at home now.
_Avoid_: stock, amount

**Need to buy** (UI: falta comprar):
The gap between the current quantity and the monthly usage; never negative.
_Avoid_: shortfall, deficit

**Restock** (UI: reponer):
Marking an item as bought: its current quantity goes back up to its monthly usage.
_Avoid_: purchase, refill

**Cycle** (UI: ciclo):
The household's shopping month, from when someone taps "Nuevo ciclo". A visual reference only: what needs
buying does not depend on it.
_Avoid_: period, month
