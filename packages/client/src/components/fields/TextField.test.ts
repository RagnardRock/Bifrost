import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TextField from './TextField.vue'

describe('TextField', () => {
  it('renders label correctly', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'title',
      },
    })

    expect(wrapper.find('label').text()).toBe('Title')
  })

  it('renders input with correct id', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'my-field',
      },
    })

    expect(wrapper.find('input').attributes('id')).toBe('my-field')
  })

  it('displays the model value', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: 'Hello World',
        label: 'Title',
        fieldKey: 'title',
      },
    })

    expect(wrapper.find('input').element.value).toBe('Hello World')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'title',
      },
    })

    await wrapper.find('input').setValue('New Value')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['New Value'])
  })

  it('displays placeholder when provided', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'title',
        placeholder: 'Enter title...',
      },
    })

    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter title...')
  })

  it('handles empty modelValue gracefully', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'title',
      },
    })

    expect(wrapper.find('input').element.value).toBe('')
  })

  it('has correct input type', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'title',
      },
    })

    expect(wrapper.find('input').attributes('type')).toBe('text')
  })

  it('links label to input via for attribute', () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: '',
        label: 'Title',
        fieldKey: 'my-field',
      },
    })

    const label = wrapper.find('label')
    const input = wrapper.find('input')

    expect(label.attributes('for')).toBe(input.attributes('id'))
  })
})
