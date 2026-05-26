import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface BlurTextProps {
  text: string;
  className?: string;
}

export default function BlurText({ text, className }: BlurTextProps) {
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const words = text.split(' ');

  return (
    <p
      id="blur-text-element"
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: '0.1em',
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          animate={
            isInView
              ? {
                  filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
                  opacity: [0, 0.5, 1],
                  y: [50, -5, 0],
                }
              : { filter: 'blur(10px)', opacity: 0, y: 50 }
          }
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: 'easeOut',
            delay: (i * 100) / 1000,
          }}
          style={{
            display: 'inline-block',
            marginRight: '0.28em',
          }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}
