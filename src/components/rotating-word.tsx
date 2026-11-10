"use client";

import { useEffect, useState } from "react";

/** Palabra del título que va cambiando de plato cada par de segundos. */
export function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), 2200);
    return () => clearInterval(timer);
  }, [words.length]);

  // La clave reinicia la animación de entrada en cada cambio.
  return (
    <span key={index} className="swap-word gradient-text">
      {words[index]}
    </span>
  );
}
