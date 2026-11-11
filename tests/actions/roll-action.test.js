import { describe, expect, it, vi } from 'vitest';
import { MAP_ACTIONS, rollSystemAction } from '../../scripts/actions/roll-action.js';

const actor = { name: 'Valeros' };

// A stand-in for game.pf2e.actions: a Map of action objects (the system's
// current API) that also carries legacy camelCase functions as properties.
function fakeActions({ objects = {}, legacy = {} } = {}) {
  const map = new Map(Object.entries(objects));
  return Object.assign(map, legacy);
}

function actionObject() {
  return { use: vi.fn(() => Promise.resolve([])) };
}

describe('MAP_ACTIONS', () => {
  it('covers the suggested actions that have the attack trait', () => {
    expect([...MAP_ACTIONS].sort()).toEqual(['disarm', 'escape', 'grapple', 'reposition', 'shove', 'trip']);
  });

  it('leaves out Tumble Through, which is a move action', () => {
    expect(MAP_ACTIONS.has('tumble-through')).toBe(false);
  });
});

describe('rollSystemAction', () => {
  it('rolls an attack action through its action object with no penalty on the first attack', () => {
    const trip = actionObject();
    const handled = rollSystemAction(fakeActions({ objects: { trip } }), { actor, slug: 'trip' });
    expect(handled).toBe(true);
    expect(trip.use).toHaveBeenCalledWith({ actors: [actor] });
  });

  it.each([[1], [2]])('passes multiple attack penalty step %i to the action object', (map) => {
    const shove = actionObject();
    rollSystemAction(fakeActions({ objects: { shove } }), { actor, slug: 'shove', map });
    expect(shove.use).toHaveBeenCalledWith({ actors: [actor], multipleAttackPenalty: map });
  });

  it('rolls Escape with a penalty through its action object', () => {
    const escape = actionObject();
    rollSystemAction(fakeActions({ objects: { escape } }), { actor, slug: 'escape', map: 2 });
    expect(escape.use).toHaveBeenCalledWith({ actors: [actor], multipleAttackPenalty: 2 });
  });

  it('keeps using the legacy function for actions without a penalty', () => {
    const raiseAShield = vi.fn();
    const shieldObject = actionObject();
    const actions = fakeActions({ objects: { 'raise-a-shield': shieldObject }, legacy: { raiseAShield } });
    const handled = rollSystemAction(actions, { actor, slug: 'raise-a-shield', options: { foo: 1 } });
    expect(handled).toBe(true);
    expect(raiseAShield).toHaveBeenCalledWith({ actors: [actor], foo: 1 });
    expect(shieldObject.use).not.toHaveBeenCalled();
  });

  it('passes extra options such as a variant through to the legacy function', () => {
    const createADiversion = vi.fn();
    rollSystemAction(fakeActions({ legacy: { createADiversion } }), {
      actor, slug: 'create-a-diversion', options: { variant: 'gesture' },
    });
    expect(createADiversion).toHaveBeenCalledWith({ actors: [actor], variant: 'gesture' });
  });

  it('falls back to the legacy function for a first attack when the action object is missing', () => {
    const trip = vi.fn();
    const handled = rollSystemAction(fakeActions({ legacy: { trip } }), { actor, slug: 'trip' });
    expect(handled).toBe(true);
    expect(trip).toHaveBeenCalledWith({ actors: [actor] });
  });

  it('refuses a penalised roll it cannot apply the penalty to', () => {
    const trip = vi.fn();
    const handled = rollSystemAction(fakeActions({ legacy: { trip } }), { actor, slug: 'trip', map: 1 });
    expect(handled).toBe(false);
    expect(trip).not.toHaveBeenCalled();
  });

  it('falls back to the action object when there is no legacy function', () => {
    const takeCover = actionObject();
    const handled = rollSystemAction(fakeActions({ objects: { 'take-cover': takeCover } }), { actor, slug: 'take-cover' });
    expect(handled).toBe(true);
    expect(takeCover.use).toHaveBeenCalledWith({ actors: [actor] });
  });

  it('hands a failed fallback action-object roll to onError', async () => {
    const error = new Error('nope');
    const takeCover = { use: vi.fn(() => Promise.reject(error)) };
    const onError = vi.fn();
    rollSystemAction(fakeActions({ objects: { 'take-cover': takeCover } }), { actor, slug: 'take-cover', onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('does not use the action object fallback for a penalised non-attack action', () => {
    const takeCover = actionObject();
    const handled = rollSystemAction(fakeActions({ objects: { 'take-cover': takeCover } }), { actor, slug: 'take-cover', map: 1 });
    expect(handled).toBe(false);
    expect(takeCover.use).not.toHaveBeenCalled();
  });

  it('rolls Battle Medicine as a Medicine check', () => {
    const roll = vi.fn(() => Promise.resolve());
    const medic = { name: 'Medic', skills: { medicine: { roll } } };
    const handled = rollSystemAction(fakeActions(), { actor: medic, slug: 'battle-medicine' });
    expect(handled).toBe(true);
    expect(roll).toHaveBeenCalledWith({
      label: 'Battle Medicine',
      traits: ['healing', 'manipulate'],
      extraRollOptions: ['action:battle-medicine'],
    });
  });

  it('hands a failed Battle Medicine roll to onError', async () => {
    const error = new Error('boom');
    const medic = { skills: { medicine: { roll: vi.fn(() => Promise.reject(error)) } } };
    const onError = vi.fn();
    rollSystemAction(fakeActions(), { actor: medic, slug: 'battle-medicine', onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('hands a Battle Medicine roll that throws straight away to onError', () => {
    const error = new Error('sync');
    const medic = { skills: { medicine: { roll: vi.fn(() => { throw error; }) } } };
    const onError = vi.fn();
    expect(rollSystemAction(fakeActions(), { actor: medic, slug: 'battle-medicine', onError })).toBe(true);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('Battle Medicine without a Medicine statistic is not handled', () => {
    expect(rollSystemAction(fakeActions(), { actor: { skills: {} }, slug: 'battle-medicine' })).toBe(false);
    expect(rollSystemAction(fakeActions(), { actor, slug: 'battle-medicine' })).toBe(false);
  });

  it('reports an unknown action as not handled', () => {
    expect(rollSystemAction(fakeActions(), { actor, slug: 'no-such-action' })).toBe(false);
  });

  it('reports not handled when the pf2e action registry is missing', () => {
    expect(rollSystemAction(undefined, { actor, slug: 'trip' })).toBe(false);
  });

  it('hands a failed action-object roll to onError', async () => {
    const error = new Error('No applicable statistic');
    const grapple = { use: vi.fn(() => Promise.reject(error)) };
    const onError = vi.fn();
    rollSystemAction(fakeActions({ objects: { grapple } }), { actor, slug: 'grapple', map: 1, onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('hands an action object that throws straight away to onError', () => {
    const error = new Error('boom');
    const disarm = { use: vi.fn(() => { throw error; }) };
    const onError = vi.fn();
    expect(() => rollSystemAction(fakeActions({ objects: { disarm } }), { actor, slug: 'disarm', onError })).not.toThrow();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
