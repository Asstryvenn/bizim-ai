"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STEP_KEYS = [
  "sales",
  "averageCheck",
  "clients",
  "profit",
  "instagram",
  "tiktok",
  "promotions",
  "growth",
];

export default function AIThinking() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((v) => (v < STEP_KEYS.length ? v + 1 : 1));
    }, 900);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-8 shadow-xl">
      <h2 className="text-2xl font-bold mb-6">🤖 {t("aiThinking.title")}</h2>

      <div className="space-y-3">
        {STEP_KEYS.map((key, index) => (
          <div
            key={key}
            className={`transition-all duration-500 ${
              index < visible
                ? "opacity-100 translate-x-0"
                : "opacity-20 translate-x-2"
            }`}
          >
            ✔ {t(`aiThinking.steps.${key}`)}
          </div>
        ))}
      </div>
    </div>
  );
}
