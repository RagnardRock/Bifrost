import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BooleanField from './BooleanField.vue'

describe('BooleanField', () => {
  it('renders label correctly', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    expect(wrapper.find('label').text()).toBe('Active')
  })

  it('renders switch button with correct role', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    expect(wrapper.find('button').attributes('role')).toBe('switch')
  })

  it('displays false state correctly', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    expect(wrapper.find('button').classes()).toContain('bg-gray-600')
  })

  it('displays true state correctly', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: true,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('button').classes()).toContain('bg-blue-600')
  })

  it('emits update:modelValue when clicked', async () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('toggles from true to false', async () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: true,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('renders switch with correct id', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'my-toggle',
      },
    })

    expect(wrapper.find('button').attributes('id')).toBe('my-toggle')
  })

  it('links label to button via for attribute', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: false,
        label: 'Active',
        fieldKey: 'my-toggle',
      },
    })

    const label = wrapper.find('label')
    const button = wrapper.find('button')

    expect(label.attributes('for')).toBe(button.attributes('id'))
  })

  it('handles undefined modelValue as false', () => {
    const wrapper = mount(BooleanField, {
      props: {
        modelValue: undefined as unknown as boolean,
        label: 'Active',
        fieldKey: 'active',
      },
    })

    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
  })
})
