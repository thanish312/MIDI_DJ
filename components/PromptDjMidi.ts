/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Prompt, PlaybackState } from '../types';
import { MidiController } from '../utils/MidiController';
import './PromptSlider';
import './PlayPauseButton';
import './FilteredPromptList';
import { FilteredPromptList } from './FilteredPromptList';
import './Visualizer';

@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  @property({ type: Object }) prompts = new Map<string, Prompt>();
  @property({ type: String }) playbackState: PlaybackState = 'stopped';
  @property({ type: Number }) audioLevel = 0;

  @state() private midiSupported = false;
  @state() private midiDevices: string[] = [];

  private midiController: MidiController;

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      flex-direction: column;
      user-select: none;
    }
    .prompts {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 16px;
    }
    .controls {
      display: flex;
      padding: 16px;
      gap: 16px;
      border-top: 1px solid #eee;
    }
    .play-pause-button {
      width: 48px;
      height: 48px;
    }
    .visualizer {
      flex-grow: 1;
      height: 48px;
    }
    .no-midi {
      padding: 16px;
      background-color: #eee;
      border-radius: 8px;
    }
    .repub-info {
      position: absolute;
      bottom: 16px;
      right: 16px;
      font-size: 12px;
      color: #888;
    }
  `;

  constructor(initialPrompts: Map<string, Prompt>) {
    super();
    this.prompts = initialPrompts;
    this.midiController = new MidiController();
    this.midiSupported = this.midiController.isSupported();

    this.midiController.addEventListener('control-change', ((e: Event) => {
      const customEvent = e as CustomEvent<{ cc: number, value: number }>;
      const { cc, value } = customEvent.detail;
      this.handleMidiControlChange(cc, value);
    }));

    this.midiController.addEventListener('state-change', ((e: Event) => {
      const customEvent = e as CustomEvent<{ devices: string[] }>;
      this.midiDevices = customEvent.detail.devices;
    }));

    this.midiController.addEventListener('error', ((e: Event) => {
      const customEvent = e as CustomEvent<string>;
      this.dispatchEvent(new CustomEvent('error', { detail: customEvent.detail }));
    }));

    this.midiController.start();
  }

  handleMidiControlChange(cc: number, value: number) {
    for (const prompt of this.prompts.values()) {
      if (prompt.cc === cc) {
        prompt.weight = value / 127;
        this.requestUpdate();
        this.dispatchPromptsChanged();
        break;
      }
    }
  }

  handleSliderChange(promptId: string, weight: number) {
    const prompt = this.prompts.get(promptId);
    if (prompt) {
      prompt.weight = weight;
      this.requestUpdate();
      this.dispatchPromptsChanged();
    }
  }

  dispatchPromptsChanged() {
    this.dispatchEvent(new CustomEvent('prompts-changed', {
      detail: this.prompts,
      bubbles: true,
      composed: true
    }));
  }

  addFilteredPrompt(prompt: string) {
    const filteredPromptList = this.shadowRoot?.querySelector('filtered-prompt-list') as FilteredPromptList;
    filteredPromptList.addPrompt(prompt);
  }

  override render() {
    return html`
      <div class="prompts">
        ${this.midiSupported
          ? this.renderSliders()
          : html`<div class="no-midi">MIDI not supported. Please use Chrome, Edge, or Opera.</div>`
        }
      </div>
      <div class="controls">
        <play-pause-button
          class="play-pause-button"
          .playbackState=${this.playbackState}
          @play-pause=${() => this.dispatchEvent(new CustomEvent('play-pause'))}
        ></play-pause-button>
        <visualizer-element class="visualizer" .audioLevel=${this.audioLevel}></visualizer-element>
      </div>
      <filtered-prompt-list></filtered-prompt-list>
      <div class="repub-info">repub access by Thanish</div>
    `;
  }

  renderSliders() {
    return html`
      ${Array.from(this.prompts.values()).map(prompt => html`
        <prompt-slider
          .promptId=${prompt.promptId}
          .text=${prompt.text}
          .weight=${prompt.weight}
          .color=${prompt.color}
          @slider-change=${(e: CustomEvent) => this.handleSliderChange(e.detail.promptId, e.detail.weight)}
        ></prompt-slider>
      `)}
    `;
  }
}