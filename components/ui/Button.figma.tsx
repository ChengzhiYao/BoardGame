import figma from '@figma/code-connect';
import { Button } from './Button';
figma.connect(Button, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=6-15', {
  props: {
    variant: figma.enum('Variant', { Primary: 'primary', Secondary: 'secondary', Ghost: 'ghost', Mystic: 'mystic' }),
    label: figma.string('Label'),
  },
  example: ({ variant, label }) => <Button variant={variant}>{label}</Button>,
});
