import React from "react";
import { Composition, staticFile } from "remotion";
import { Clinch, type ClinchProps } from "./Clinch";
import { buildTimeline, FPS } from "./timeline.mjs";

export const Root: React.FC = () => (
  <Composition
    id="Clinch"
    component={Clinch}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={300}
    defaultProps={{ edit: null } as unknown as ClinchProps}
    calculateMetadata={async () => {
      const res = await fetch(staticFile("edit.resolved.json"));
      const edit = await res.json();
      const timeline = buildTimeline(edit);
      return { durationInFrames: timeline.durationInFrames, props: { edit, timeline } as ClinchProps };
    }}
  />
);
