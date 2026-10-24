---
name: grill-me
description: Entrevista implacable para afilar un plan o diseño. Úsala cuando el usuario pide someter a presión una decisión, plan o idea, o dice "grill", "gríllame" o "stress-test".
---

# Grill Me

Entrevista al usuario de forma implacable hasta llegar a un entendimiento compartido.
Mapea esto como un **árbol de diseño**: cada decisión se ramifica en las decisiones que
cuelgan de ella.

Trabaja el árbol por **rondas**. La **frontera** es cada decisión cuyos prerrequisitos ya
están resueltos: las preguntas que puedes hacer AHORA sin adivinar respuestas que aún no
has escuchado. Pregunta toda la frontera de una ronda: numera cada pregunta y da tu
respuesta recomendada. Después espera las respuestas del usuario antes de la siguiente ronda.

Formatea una ronda así:

```
❓ **Q1** - **<título de la pregunta>**: <cuerpo de la pregunta, puede ser varios párrafos, con opciones>

➡️ <tu respuesta recomendada>

---

❓ **Q2** - **<título de la pregunta>**: <cuerpo de la pregunta>

➡️ <tu respuesta recomendada>
```

Redacta cada pregunta de modo que un "sí" acepte tu respuesta recomendada.

Cada ronda de respuestas remodela el árbol: las decisiones resueltas empujan la frontera
hacia afuera y desbloquean las preguntas que dependían de ellas. Recalcula la frontera y
haz la siguiente ronda. Una pregunta cuya respuesta depende de otra que sigue abierta en
esta ronda pertenece a una ronda POSTERIOR, no a esta.

Encontrar **hechos** es tu trabajo, nunca el del usuario. Cuando una pregunta de la
frontera necesite un hecho del entorno (sistema de archivos, herramientas, etc.), despacha
un subagente para encontrarlo; no preguntes al usuario nada que puedas buscar tú mismo.
No te bloquees por ello: una exploración en curso es un prerrequisito sin resolver, así que
solo las preguntas que dependen de ella esperan a que el subagente informe; haz el resto de
la frontera ahora. Las **decisiones** son del usuario: ponlas a su espera y espera.

La sesión termina cuando la frontera está vacía: cada rama del árbol de diseño visitada,
nada asumido en silencio. No actúes sobre ello hasta que el usuario confirme que han
llegado a un entendimiento compartido.
