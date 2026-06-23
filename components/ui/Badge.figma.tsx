import figma from '@figma/code-connect';
import { Badge } from './Badge';
figma.connect(Badge, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=7-28', {
  props: {
    tone: figma.enum('Tone', { Neutral: 'neutral', Success: 'success', Warning: 'warning', Danger: 'danger', Info: 'info' }),
    label: figma.string('Label'),
  },
  example: ({ tone, label }) => <Badge tone={tone}>{label}</Badge>,
});
