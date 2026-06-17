## Context

El toggle "Hacer recurrente" ya existe y funciona (frecuencia, intervalo custom, fecha de fin). Lo único que falta es comunicación: el usuario no sabe para qué sirve. El feedback de UX del proyecto fue claro en que el texto gris pequeño "no se ve" — por eso el hint nuevo debe tener color/presencia, no ser otra nota tenue.

## Decisions

**D1: Hint contextual permanente, NO guidance persistido**

El hint aparece siempre que el toggle está activo y desaparece al desactivarlo. No se persiste en `user_guidance_events` ni se marca como "visto".

*Rationale:* Es ayuda contextual, no onboarding. Que esté siempre disponible es mejor que mostrarlo una vez; y evita el costo de un guidance id + migración para algo que es esencialmente helper text con formato.

**D2: Presencia visual con tinte emerald**

El hint usa el mismo lenguaje que el ícono activo del toggle (`emerald-soft` de fondo, `emerald-deep` para el ícono/acento), con un ícono de lámpara. No es texto gris suelto.

*Rationale:* Responde directamente al feedback "el gris no se ve". El verde ya es el color del toggle activo, así que es coherente.

**D3: Info partida por momento de decisión**

El error a evitar: esconder el "para qué" detrás de la activación (el usuario que no sabe qué es, no lo activa para enterarse). Entonces:
- Nota (siempre visible, ANTES de activar) → propósito + ejemplos, para decidir si sirve: "Para lo que pagás seguido: alquiler, suscripciones, el sueldo."
- Hint (al activar) → el mecanismo, qué pasa ahora: "Cuando toca, Grana te lo deja listo y vos lo registrás con un toque. Nunca se carga solo sin tu OK."

*Rationale:* La decisión ("¿esto es para mí?") necesita info antes del toggle; el mecanismo ("¿y ahora qué?") recién importa después. El "Nunca se carga solo sin tu OK" reemplaza el "te pide confirmar" como tranquilidad, no como trámite; "con un toque" comunica el ahorro de esfuerzo, que es el valor real.
