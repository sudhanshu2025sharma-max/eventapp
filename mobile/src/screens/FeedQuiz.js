import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { COLORS, SPACE, RADIUS } from '../theme';

export default function FeedQuiz({ postId, quiz }) {
  const [current, setCurrent] = useState(quiz);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    setCurrent(quiz);
    setSelected(quiz?.selected_option ?? null);
  }, [quiz]);
  if (!current) return null;

  const submit = async () => {
    if (selected === null || submitting.current || current.answered) return;
    submitting.current = true;
    setBusy(true);
    try {
      const response = await apiFetch(`/posts/feed/${postId}/answer/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_option: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not submit your answer.');
      setCurrent(data.quiz);
      setSelected(data.quiz.selected_option);
    } catch (error) {
      Alert.alert('Quiz', error.message || 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.heading}>{current.question}</Text>
      <Text style={s.hint}>Choose one answer · {current.response_count} responses</Text>
      {current.options.map((option, index) => {
        const chosen = current.answered ? current.selected_option === index : selected === index;
        const correct = current.answered && current.correct_option === index;
        return (
          <TouchableOpacity key={index} accessibilityRole="radio"
            accessibilityState={{ checked: chosen, disabled: current.answered || busy }}
            disabled={current.answered || busy} onPress={() => setSelected(index)}
            style={[s.option, chosen && s.selected, correct && s.correct]}>
            <Text style={s.optionText}>{chosen ? '●' : '○'} {option}{correct ? ' ✓' : ''}</Text>
          </TouchableOpacity>
        );
      })}
      {current.answered ? (
        <Text accessibilityLiveRegion="polite" style={s.feedback}>
          {current.correct_option != null
            ? `${current.is_correct ? 'Correct! Well done.' : `Correct answer: ${current.options[current.correct_option]}`}\n`
            : ''}Your answer has been recorded.
        </Text>
      ) : (
        <TouchableOpacity accessibilityRole="button" disabled={selected === null || busy}
          onPress={submit} style={[s.submit, (selected === null || busy) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit answer</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { margin: SPACE.lg, gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.textSec },
  option: { padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  selected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  correct: { borderColor: '#16804a', backgroundColor: '#eaf8ef' },
  optionText: { color: COLORS.text, fontSize: 14 },
  feedback: { color: COLORS.text, lineHeight: 22 },
  submit: { backgroundColor: COLORS.brand, padding: 14, borderRadius: RADIUS.md, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
});
