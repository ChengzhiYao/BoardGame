import figma from '@figma/code-connect';
import { ScoreBar } from './ScoreBar';
figma.connect(ScoreBar, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=7-30', {
  props: { label: figma.string('label') },
  example: ({ label }) => <ScoreBar label={label} score={8} max={10} />,
});
