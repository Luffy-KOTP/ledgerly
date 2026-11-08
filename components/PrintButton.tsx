'use client'
export default function PrintButton() { return <button onClick={() => window.print()} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white print:hidden">Print or save as PDF</button> }
