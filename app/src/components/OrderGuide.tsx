import { ArrowDown, Check } from "lucide-react"
import { motion } from "motion/react"
import type { Order } from "../data/types"
import { ORDER_STEPS, orderGuide, turnLabels } from "../lib/orderGuide"

export function StepBar({ step, labels = false }: { step: number; labels?: boolean }) {
  const closed = step < 0
  return (
    <div className={`step-bar${labels ? " step-bar-labeled" : ""}${closed ? " is-closed" : ""}`}>
      <ol aria-label={closed ? "Pesanan ditutup" : `Langkah ${step + 1} dari ${ORDER_STEPS.length}: ${ORDER_STEPS[step]}`}>
        {ORDER_STEPS.map((label, index) => {
          const state = closed ? "" : index < step || (index === step && step === ORDER_STEPS.length - 1) ? "done" : index === step ? "now" : ""
          return (
            <li key={label} className={state}>
              <span className="step-bar-seg" />
              {labels && (
                <span className="step-bar-label">
                  <i>{state === "done" ? <Check /> : index + 1}</i>
                  {label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {!closed && <small>Langkah {step + 1}/{ORDER_STEPS.length} · {ORDER_STEPS[step]}</small>}
    </div>
  )
}

export function NextStepCard({ order }: { order: Order }) {
  const guide = orderGuide(order)
  const jump = () => {
    if (!guide.target) return
    const element = document.getElementById(guide.target)
    element?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })
    element?.classList.add("is-flash")
    window.setTimeout(() => element?.classList.remove("is-flash"), 1600)
  }

  return (
    <motion.section
      className={`next-step turn-${guide.turn}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      <div className="next-step-body">
        <div>
          <span className="turn-chip">{turnLabels[guide.turn]}</span>
          <h2>{guide.headline}</h2>
          <p>{guide.detail}</p>
        </div>
        {guide.action && (
          <button type="button" className="btn-lime next-step-action" onClick={jump}>
            {guide.action} <ArrowDown />
          </button>
        )}
      </div>
      <StepBar step={guide.step} labels />
    </motion.section>
  )
}
