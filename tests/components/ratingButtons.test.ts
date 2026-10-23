import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Interval, Rating } from '@/domain/scheduling/types';
import RatingButtons from '@/presentation/components/RatingButtons.vue';

const interval = (days: number): Interval => ({ days, dueAt: 0 });
const preview: Record<Rating, Interval> = {
  again: interval(1),
  hard: interval(6),
  good: interval(15),
  easy: interval(38),
};

describe('RatingButtons', () => {
  it('renders the four buttons in order with the predicted interval on each', () => {
    const wrapper = mount(RatingButtons, { props: { preview } });
    const buttons = wrapper.findAll('button');
    expect(buttons.map((button) => button.attributes('data-rating'))).toEqual(['again', 'hard', 'good', 'easy']);
    expect(buttons.map((button) => button.text())).toEqual(['Again1d', 'Hard6d', 'Good15d', 'Easy1.3mo']);
  });

  it('announces the keyboard shortcut of every button', () => {
    const wrapper = mount(RatingButtons, { props: { preview } });
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4']);
  });

  it('emits the chosen rating', async () => {
    const wrapper = mount(RatingButtons, { props: { preview } });
    await wrapper.get('[data-rating="good"]').trigger('click');
    await wrapper.get('[data-rating="again"]').trigger('click');
    expect(wrapper.emitted('rate')).toEqual([['good'], ['again']]);
  });

  it('shows no intervals when the setting is off', () => {
    const wrapper = mount(RatingButtons, { props: { preview: null } });
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['Again', 'Hard', 'Good', 'Easy']);
  });
});
