import type { StyleProp, TextStyle } from "react-native";
import type { WithSpringConfig } from "react-native-reanimated";

export interface CharacterAnimationParams {
  opacity: number;
  translateY: number;
  scale: number;
  rotate: number; // in degrees
}

export interface AnimationConfig {
  characterDelay: number;
  characterEnterDuration: number;
  characterExitDuration: number;
  layoutTransitionDuration: number;
  maxBlurIntensity?: number;
  spring: WithSpringConfig;
}

export interface CharacterProps {
  char: string;
  style?: StyleProp<TextStyle>;
  index: number;
  totalChars?: number;
  animationConfig: AnimationConfig;
  enterFrom: CharacterAnimationParams;
  enterTo: CharacterAnimationParams;
  exitFrom: CharacterAnimationParams;
  exitTo: CharacterAnimationParams;
}

export interface StaggeredTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  animationConfig?: Partial<AnimationConfig>;
  enterFrom?: Partial<CharacterAnimationParams>;
  enterTo?: Partial<CharacterAnimationParams>;
  exitFrom?: Partial<CharacterAnimationParams>;
  exitTo?: Partial<CharacterAnimationParams>;
}

