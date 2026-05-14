// Mock de lucide-react para testes
const React = require('react');

const createMockIcon = (name) => {
  const MockIcon = (props) => React.createElement('svg', {
    'data-testid': `icon-${name.toLowerCase()}`,
    role: 'img',
    'aria-label': name,
    ...props
  });
  MockIcon.displayName = name;
  return MockIcon;
};

module.exports = {
  Bell: createMockIcon('Bell'),
  X: createMockIcon('X'),
  Check: createMockIcon('Check'),
  AlertCircle: createMockIcon('AlertCircle'),
  Info: createMockIcon('Info'),
  Send: createMockIcon('Send'),
  CheckCircle: createMockIcon('CheckCircle'),
  CheckCircle2: createMockIcon('CheckCircle2'),
  XCircle: createMockIcon('XCircle'),
  AlertTriangle: createMockIcon('AlertTriangle'),
  Loader2: createMockIcon('Loader2'),
  Star: createMockIcon('Star'),
};
