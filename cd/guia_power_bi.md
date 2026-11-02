# Guía básica de Power BI

## Qué es Power BI

Power BI es una herramienta de Microsoft que permite transformar datos provenientes de planillas, bases de datos u otros sistemas en dashboards interactivos. Su objetivo principal es facilitar el análisis y la toma de decisiones a partir de la información disponible.

Antes de comenzar un proyecto, es recomendable definir el problema de negocio que se quiere resolver o el valor que se busca obtener con el análisis. Por ejemplo, identificar la facturación total, el comportamiento de las ventas por mes o el rendimiento de cada sucursal.

Power BI puede conectarse a múltiples fuentes de datos, como Excel, archivos CSV, bases de datos SQL, Oracle, SAP y páginas web. Esto permite cruzar información de distintas procedencias dentro de un mismo reporte.

La versión **Power BI Desktop** es gratuita y resulta suficiente para desarrollar la mayoría de los proyectos de análisis y visualización.

## Descarga e instalación

1. Buscar **Power BI Desktop** en el navegador e ingresar al resultado oficial de Microsoft Store.
2. Hacer clic en **Descargar ahora**.
3. En Microsoft Store, seleccionar **Descargar** para comenzar la instalación.
4. Una vez instalada, abrir la aplicación Power BI Desktop.
5. La versión gratuita permite crear dashboards y analizar datos sin necesidad de una suscripción paga.

## Explorar la herramienta

La interfaz de Power BI Desktop se organiza de forma similar a Excel y PowerPoint:

- **Cinta de opciones superior:** contiene los menús y comandos principales.
- **Panel de visualizaciones:** permite elegir los tipos de gráficos y objetos, como tarjetas, gráficos de barras, líneas o tablas.
- **Panel de datos:** muestra las tablas y campos disponibles después de cargar la información.
- **Área de trabajo:** es el lienzo donde se construye el dashboard.

Antes de crear visualizaciones, conviene explorar la estructura de los datos y definir qué preguntas se desea responder. No es necesario memorizar todas las opciones de la herramienta; es más útil aprender a partir de un caso práctico.

## Carga de información

1. Abrir Power BI Desktop.
2. Seleccionar **Obtener datos**.
3. Elegir la fuente correspondiente; por ejemplo, **Excel** si los datos están en un libro de Excel.
4. Buscar y seleccionar el archivo.
5. Revisar la vista previa de las hojas o tablas disponibles.
6. Seleccionar las tablas que se utilizarán en el análisis.
7. En lugar de presionar directamente **Cargar**, elegir **Transformar datos** para abrir Power Query.
8. Revisar la calidad de los datos antes de incorporarlos al modelo.

Es recomendable transformar los datos antes de cargarlos, porque permite corregir errores, estandarizar textos, separar columnas y definir tipos de datos.

## Análisis exploratorio

El análisis exploratorio consiste en revisar la información antes de construir el dashboard. En esta etapa se busca entender la estructura de los datos y detectar posibles problemas.

Al explorar una base de ventas, por ejemplo, se pueden revisar campos como:

- ID de pedido
- Fecha del pedido
- Código de tienda
- Producto
- Cantidad
- Precio unitario
- Medio de pago

Durante esta revisión conviene identificar:

- Cantidad de registros disponibles.
- Nombres y significado de cada columna.
- Tipos de datos de cada campo.
- Valores vacíos o nulos.
- Errores de escritura o inconsistencias en los textos.
- Campos combinados que deban separarse.
- Relaciones posibles entre tablas.

También es importante consultar con quienes generan o administran los datos cuando existan dudas sobre el significado de un campo. Por ejemplo, un valor como `23/210` puede representar una cantidad de 23 unidades y un precio unitario de 210.

A partir del análisis exploratorio se pueden definir preguntas de negocio, tales como:

- ¿Cuál es la facturación total?
- ¿Cómo evolucionan las ventas por mes?
- ¿Qué tienda genera mayor facturación?
- ¿Cuál es el ticket medio por venta?
- ¿Qué productos concentran más ventas?

## Transformar datos

Las transformaciones se realizan en **Power Query**, el entorno de limpieza y preparación de datos de Power BI.

### Corregir errores de texto

1. Hacer clic derecho sobre la columna que contiene errores.
2. Seleccionar **Reemplazar valores**.
3. Indicar el valor incorrecto y el valor correcto.
4. Confirmar el cambio.

Por ejemplo, se puede reemplazar `maletta` por `maleta`.

### Estandarizar textos

1. Hacer clic derecho sobre la columna de productos.
2. Ir a **Transformar**.
3. Seleccionar **Poner en mayúscula cada palabra**.

Esto ayuda a que los nombres de productos, categorías o sucursales tengan un formato consistente.

### Separar columnas combinadas

Si una columna contiene dos valores separados por un delimitador, como `23/210`:

1. Seleccionar la columna.
2. Ir a **Dividir columna**.
3. Elegir **Por delimitador**.
4. Seleccionar el delimitador correspondiente, por ejemplo `/`.
5. Confirmar la división.
6. Renombrar las columnas resultantes, por ejemplo, como **Cantidad** y **Precio unitario**.

### Definir tipos de datos

Después de separar o corregir los campos, asignar el tipo de dato correcto:

- **Número entero:** para cantidades.
- **Número decimal fijo:** para precios, importes y valores monetarios.
- **Fecha:** para fechas de pedidos o transacciones.
- **Texto:** para nombres, códigos y descripciones.

### Crear una columna calculada

Para calcular la facturación de cada venta:

1. Seleccionar las columnas **Cantidad** y **Precio unitario**.
2. Ir a **Agregar columna**.
3. Elegir **Estándar**.
4. Seleccionar **Multiplicar**.
5. Confirmar la operación.
6. Renombrar la nueva columna como **Facturación**.

### Corregir encabezados

Si la primera fila contiene los nombres de las columnas pero Power Query no los reconoce como encabezados:

1. Ir a **Inicio**.
2. Seleccionar **Usar primera fila como encabezados**.

### Eliminar valores vacíos

1. Hacer clic en el filtro de una columna.
2. Revisar los valores disponibles.
3. Desmarcar la opción **null**, que representa celdas vacías.
4. Confirmar el filtro.

### Renombrar tablas y columnas

Utilizar nombres claros y descriptivos para las tablas y campos. Por ejemplo, una tabla de transacciones puede llamarse **Ventas** en lugar de conservar un nombre técnico o genérico.

### Revisar la calidad de los datos

Desde el menú **Vista** de Power Query se pueden activar opciones útiles:

- **Distribución de columna:** muestra la distribución de los valores.
- **Calidad de columna:** identifica valores válidos, con error o vacíos.
- **Estadística de columna:** muestra valores únicos, mínimos, máximos y promedios.

### Aplicar los cambios

1. Revisar que todas las transformaciones estén correctas.
2. Seleccionar **Cerrar y aplicar**.
3. Esperar a que Power BI cargue los datos transformados.
4. Si es necesario realizar ajustes posteriores, volver a **Inicio > Transformar datos**.

Una ventaja importante es que los pasos de limpieza quedan registrados. Al actualizar la fuente de datos, Power BI puede repetir automáticamente las transformaciones sin modificar el archivo original.

## Creación del dashboard

### Crear una tarjeta de facturación total

1. En el panel de visualizaciones, seleccionar el visual **Tarjeta**.
2. Arrastrar el campo **Facturación** al área de campos.
3. Cambiar el título del visual a **Facturación**.
4. Ajustar el formato según el diseño deseado.

### Formatear una tarjeta

Desde el panel de formato se pueden modificar:

- Color de fondo.
- Bordes y esquinas redondeadas.
- Tamaño y color de la fuente.
- Título del visual.
- Etiquetas y detalles visuales.

### Crear el ticket medio

1. Insertar una nueva **Tarjeta**.
2. Arrastrar el campo **Facturación**.
3. Cambiar la agregación de **Suma** a **Promedio**.
4. Renombrar el visual como **Ticket medio**.
5. Copiar el formato de otra tarjeta para mantener una apariencia consistente.

### Crear un gráfico de facturación por periodo

1. Insertar un gráfico de barras.
2. Arrastrar **Fecha del pedido** al eje X.
3. Arrastrar **Facturación** al eje Y.
4. Ajustar la jerarquía de fechas para mostrar únicamente los meses, si es necesario.
5. Cambiar el título del gráfico a **Facturación por periodo**.
6. Quitar títulos redundantes de los ejes.
7. Activar las etiquetas de datos.
8. Personalizar los colores y el formato.

### Agregar líneas de referencia

En un gráfico de barras se puede agregar una línea de referencia para facilitar la interpretación:

1. Seleccionar el gráfico.
2. Ir a las opciones de análisis o formato.
3. Elegir **Agregar línea**.
4. Seleccionar una línea de promedio, mínimo o máximo.
5. Personalizar su color, estilo y etiqueta.

### Interactividad del dashboard

Los visuales de Power BI están conectados entre sí. Al seleccionar un mes, una tienda o un producto, los demás elementos del dashboard pueden filtrarse automáticamente.

Esto permite analizar la información de forma dinámica y responder preguntas como:

- ¿Cuánto se facturó en un mes específico?
- ¿Cómo cambia el ticket medio al filtrar por sucursal?
- ¿Qué productos impulsan las ventas de un periodo determinado?

## Recomendaciones finales

- Definir primero el objetivo del análisis.
- Revisar y limpiar los datos antes de crear visualizaciones.
- Usar nombres claros para tablas, columnas y visuales.
- Mantener un formato visual consistente en todo el dashboard.
- Elegir gráficos según la pregunta que se desea responder.
- Probar los filtros e interacciones entre visuales.
- Actualizar la fuente de datos cuando sea necesario; Power BI aplicará nuevamente las transformaciones guardadas.
