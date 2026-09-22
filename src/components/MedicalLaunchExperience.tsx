import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Brain, Dna, HeartPulse, Stethoscope } from "lucide-react";
import { Capacitor } from "@capacitor/core";

const steps = [Dna, Activity, HeartPulse, Stethoscope, Brain];

export default function MedicalLaunchExperience() {
  const [visible, setVisible] = useState(() => Capacitor.isNativePlatform());

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Skip opening animation"
          className="fixed inset-0 z-[250] flex w-full flex-col items-center justify-center overflow-hidden bg-[hsl(174,62%,16%)] px-6 text-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.025 }}
          transition={{ duration: 0.35 }}
          onClick={() => setVisible(false)}
        >
          <motion.div
            className="absolute h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
            animate={{ scale: [0.8, 1.2, 0.9], opacity: [0.35, 0.75, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
          <div className="relative flex items-center gap-2 sm:gap-4">
            {steps.map((Icon, index) => (
              <div key={index} className="flex items-center gap-2 sm:gap-4">
                <motion.span
                  className="flex h-11 w-11 items-center justify-center border-y border-white/15 bg-white/10 shadow-lg sm:h-14 sm:w-14"
                  initial={{ opacity: 0.25, y: 10, scale: 0.85 }}
                  animate={{ opacity: [0.3, 1, 0.55], y: [10, 0, 0], scale: [0.85, 1.08, 1] }}
                  transition={{ duration: 0.75, delay: index * 0.28 }}
                >
                  <Icon className="h-5 w-5 text-emerald-200 sm:h-7 sm:w-7" />
                </motion.span>
                {index < steps.length - 1 && (
                  <motion.span
                    className="h-px w-3 bg-emerald-200/60 sm:w-7"
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.22 + index * 0.28, duration: 0.28 }}
                  />
                )}
              </div>
            ))}
          </div>
          <motion.h1 className="relative mt-9 font-serif text-4xl font-black tracking-[0.18em]" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
            OMPATH
          </motion.h1>
          <motion.p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}>
            Learn · Recall · Practice
          </motion.p>
          <motion.div className="relative mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-emerald-300" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.15, ease: "easeInOut" }} />
          </motion.div>
          <span className="relative mt-4 text-[10px] text-white/40">Tap to continue</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
