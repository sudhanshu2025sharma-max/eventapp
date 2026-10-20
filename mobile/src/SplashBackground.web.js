import React from 'react';
import { View } from 'react-native';

// A browser image avoids React Native Web's background-image rendering path.
export default function SplashBackground({ children, style }) {
  return (
    <View style={[style, { position: 'relative', overflow: 'hidden' }]}>
      {React.createElement('img', {
        src: '/app/splash-background.png',
        alt: '',
        'aria-hidden': true,
        draggable: false,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' },
      })}
      {children}
    </View>
  );
}
