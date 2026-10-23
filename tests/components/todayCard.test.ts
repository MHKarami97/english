import { RouterLinkStub, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { TodaySummary } from '@/application/TodayService';
import TodayCard from '@/presentation/components/TodayCard.vue';

const summary = (overrides: Partial<TodaySummary> = {}): TodaySummary => ({
  newAvailable: 4,
  reviewsPlanned: 8,
  dueTotal: 8,
  plannedTotal: 12,
  studiedToday: 0,
  averageSeconds: 10,
  estimatedSeconds: 120,
  streak: { current: 3, longest: 9 },
  week: [],
  ...overrides,
});

const mountCard = (value: TodaySummary) => mount(TodayCard, { props: { summary: value }, global: { stubs: { RouterLink: RouterLinkStub } } });

describe('TodayCard', () => {
  it('shows the plan, the estimate and a start link', () => {
    const wrapper = mountCard(summary());
    expect(wrapper.text()).toContain('12 cards to study');
    expect(wrapper.get('[data-test="new"]').text()).toBe('4');
    expect(wrapper.get('[data-test="due"]').text()).toBe('8');
    expect(wrapper.get('[data-test="time"]').text()).toBe('2 min');
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'review' });
    expect(wrapper.text()).toContain('Start review');
  });

  it('uses the singular for one card and says under a minute for short plans', () => {
    const wrapper = mountCard(summary({ plannedTotal: 1, estimatedSeconds: 30 }));
    expect(wrapper.text()).toContain('1 card to study');
    expect(wrapper.get('[data-test="time"]').text()).toBe('under 1 min');
  });

  it('shows the streak', () => {
    expect(mountCard(summary()).get('[data-test="streak"]').text()).toContain('3-day streak');
  });

  it('says everything is done after studying, without a start link', () => {
    const wrapper = mountCard(summary({ plannedTotal: 0, studiedToday: 14 }));
    expect(wrapper.text()).toContain('All done for today');
    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false);
  });

  it('explains an empty plan before anything was studied', () => {
    const wrapper = mountCard(summary({ plannedTotal: 0, studiedToday: 0 }));
    expect(wrapper.text()).toContain('Nothing to study yet');
  });
});
