"use client";

import { useEffect, useState } from "react";
import { parseFinancialAmountInput } from "@/lib/utils";
import { Input } from "./input";

type MoneyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyWhenZero?: boolean;
};

const MONEY_TOLERANCE = 0.005;

export function MoneyInput({
  value,
  onValueChange,
  emptyWhenZero = true,
  inputMode = "decimal",
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(() => formatExternalMoneyValue(value, emptyWhenZero));

  useEffect(() => {
    const parsedText = parseMoneyText(text);

    if (areSameMoneyValue(parsedText, value)) {
      return;
    }

    setText(formatExternalMoneyValue(value, emptyWhenZero));
  }, [emptyWhenZero, text, value]);

  return (
    <Input
      {...props}
      inputMode={inputMode}
      value={text}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        onValueChange(parseMoneyText(nextText));
      }}
    />
  );
}

function parseMoneyText(value: string) {
  const parsed = parseFinancialAmountInput(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatExternalMoneyValue(value: number, emptyWhenZero: boolean) {
  if (!Number.isFinite(value) || (emptyWhenZero && value <= 0)) {
    return "";
  }

  return String(value);
}

function areSameMoneyValue(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < MONEY_TOLERANCE;
}
