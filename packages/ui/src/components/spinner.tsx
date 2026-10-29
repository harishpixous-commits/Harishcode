import { For, splitProps, type ComponentProps } from "solid-js"
import { syncSpinPhase } from "../hooks/spin-phase"
import { harishKeyframes, harishLoop, harishStrokes } from "./spinner-harish"

// Every AI activity spinner (busy session tabs, the activity chip, subagents, tool cards) shows Harish Pulse, the HC
// monogram lit stroke by stroke. Non-AI loading uses Loader.

const keyframes = "spinner-harish"

const strokes = harishStrokes()

// The keyframes are added to the document once, the first time a spinner renders.
let added = false

export function Spinner(props: ComponentProps<"svg"> & { "data-component"?: string }) {
  const [local, rest] = splitProps(props, ["class", "classList", "data-component"])

  if (!added) {
    added = true
    const style = document.createElement("style")
    style.textContent = harishKeyframes(keyframes)
    document.head.append(style)
  }

  return (
    <svg
      {...rest}
      ref={syncSpinPhase}
      viewBox="0 0 16 16"
      data-component={local["data-component"] ?? "spinner"}
      data-slot="spinner-dots"
      classList={{ ...local.classList, [local.class ?? ""]: !!local.class }}
      fill="currentColor"
    >
      {/* The 24-unit mark, scaled and centred in the 16-unit box. */}
      <g transform="translate(-0.667 0) scale(0.6667)">
        <For each={strokes}>
          {(stroke) => (
            <rect
              x={stroke.x}
              y={stroke.y}
              width={stroke.w}
              height={stroke.h}
              style={{
                "--still": stroke.still,
                animation: `${keyframes} calc(${harishLoop}s * var(--spinner-time, 1)) linear calc(${-harishLoop * stroke.at}s * var(--spinner-time, 1)) infinite`,
              }}
            />
          )}
        </For>
      </g>
    </svg>
  )
}
