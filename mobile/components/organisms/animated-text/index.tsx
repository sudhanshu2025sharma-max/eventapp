import { StyleSheet, View } from "react-native";
import React, { memo, useEffect } from "react";
import Animated, {
  withTiming,
  withDelay,
  withSpring,
  Easing,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import type {
  StaggeredTextProps,
  AnimationConfig,
  CharacterAnimationParams,
  CharacterProps,
} from "./types";
import {
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_ENTER_FROM,
  DEFAULT_ENTER_TO,
  DEFAULT_EXIT_FROM,
  DEFAULT_EXIT_TO,
} from "./conf";

const Character: React.FC<CharacterProps> = memo<CharacterProps>(
  ({
    char,
    style,
    index,
    animationConfig,
    enterFrom,
    enterTo,
  }: CharacterProps): React.ReactNode & React.JSX.Element & React.ReactElement => {
    const opacity = useSharedValue(enterFrom.opacity);
    const translateY = useSharedValue(enterFrom.translateY);
    const scale = useSharedValue(enterFrom.scale);
    const rotate = useSharedValue(enterFrom.rotate);

    useEffect(() => {
      const delay = index * animationConfig.characterDelay;
      const timingConfig = {
        duration: animationConfig.characterEnterDuration,
        easing: Easing.out(Easing.ease),
      };
      const springConfig = animationConfig.spring;

      opacity.value = withDelay(delay, withTiming(enterTo.opacity, timingConfig));
      translateY.value = withDelay(delay, withSpring(enterTo.translateY, springConfig));
      scale.value = withDelay(delay, withSpring(enterTo.scale, springConfig));
      rotate.value = withDelay(delay, withSpring(enterTo.rotate, springConfig));
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotate.value}deg` },
      ],
    }));

    return (
      <View style={styles.characterWrapper}>
        <Animated.Text style={[style, animatedStyle]}>
          {char === ' ' ? '\u00A0' : char}
        </Animated.Text>
      </View>
    );
  },
);

export const StaggeredText: React.FC<StaggeredTextProps> =
  memo<StaggeredTextProps>(
    ({
      text,
      style,
      animationConfig,
      enterFrom,
      enterTo,
      exitFrom,
      exitTo,
    }: StaggeredTextProps): React.ReactNode &
      React.JSX.Element &
      React.ReactElement => {
      const characters = Array.from<string>(text);

      const mergedAnimationConfig: AnimationConfig = {
        ...DEFAULT_ANIMATION_CONFIG,
        ...animationConfig,
        spring: {
          ...DEFAULT_ANIMATION_CONFIG.spring,
          ...animationConfig?.spring,
        },
      };

      const mergedEnterFrom: CharacterAnimationParams = {
        ...DEFAULT_ENTER_FROM,
        ...enterFrom,
      };

      const mergedEnterTo: CharacterAnimationParams = {
        ...DEFAULT_ENTER_TO,
        ...enterTo,
      };

      return (
        <View style={styles.textWrapper}>
          {characters.map((char, index) => (
            <Character
              key={`${char}-${index}-${text}`}
              char={char}
              style={style}
              index={index}
              totalChars={characters.length}
              animationConfig={mergedAnimationConfig}
              enterFrom={mergedEnterFrom}
              enterTo={mergedEnterTo}
              exitFrom={exitFrom || DEFAULT_EXIT_FROM}
              exitTo={exitTo || DEFAULT_EXIT_TO}
            />
          ))}
        </View>
      );
    },
  );

export default memo<StaggeredTextProps>(StaggeredText);

const styles = StyleSheet.create({
  textWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  characterWrapper: {
    overflow: "visible",
  },
});
