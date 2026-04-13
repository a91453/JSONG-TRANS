
"use client"

import { useState, useEffect } from "react";
import { QuizEngine } from "@/components/QuizEngine";

export default function QuizPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  return (
    <div className="px-4">
      <QuizEngine />
    </div>
  );
}
