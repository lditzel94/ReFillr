# ReFillr

Stock casero compartido: cada hogar sabe qué tiene en casa y cuánto le falta para llegar a su consumo
del mes, así hacer las compras es ir y tomar las unidades faltantes.

## Personas y acceso

**Hogar**:
El grupo de personas que comparte un mismo stock. Los ítems son del hogar, nunca de una persona.
_Avoid_: casa, familia, grupo, household

**Miembro**:
Una persona que pertenece a un hogar. Cada persona es miembro de un solo hogar.
_Avoid_: usuario (para hablar del hogar), integrante

## Stock

**Ítem**:
Algo que el hogar consume y repone, con su categoría, su unidad, su consumo mensual y lo que hay en casa.
_Avoid_: producto, artículo

**Categoría**:
El grupo en que se ordena un ítem en la lista (Despensa, Baño, Limpieza, o una que cree el hogar).
_Avoid_: sección, rubro

**Unidad**:
Cómo se cuenta un ítem (rollos, cartones, paquetes). Es texto libre; nunca se convierte entre unidades.
_Avoid_: medida

**Consumo mensual**:
Cuántas unidades de un ítem usa el hogar en un mes. Es el nivel al que se quiere volver al comprar.
_Avoid_: stock objetivo, mínimo

**En casa**:
Cuántas unidades de un ítem hay ahora.
_Avoid_: stock actual, cantidad

**Falta comprar**:
Lo que separa lo que hay en casa del consumo mensual; nunca es negativo.
_Avoid_: faltante, déficit

**Reponer**:
Marcar un ítem como comprado: lo que hay en casa vuelve al consumo mensual.
_Avoid_: restock, comprar (como acción en la app)

**Ciclo**:
El mes de compras del hogar, desde que alguien toca "Nuevo ciclo". Es solo una referencia visual: lo que
falta comprar no depende del ciclo.
_Avoid_: período, mes
