"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

/** Code 128 barcode of a SKU; scanners type the SKU back, which the operation form understands. */
export function Barcode({ value, className }: { value: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      height: 44,
      width: 1.6,
      margin: 0,
      displayValue: true,
      fontSize: 12,
      font: "monospace",
      background: "transparent",
    });
  }, [value]);

  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} className={className} />;
}
