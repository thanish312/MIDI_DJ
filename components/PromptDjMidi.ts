/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111;
    }
    #grid {
      width: 80vmin;
      height: 80vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
      margin-top: 8vmin;
    }
    prompt-controller {
      width: 100%;
    }
    play-pause-button {
      position: relative;
      width: 15vmin;
    }
    #buttons {
      position: absolute;
      top: 0;
      left: 0;
      padding: 5px;
      display: flex;
      gap: 5px;
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff;
      border-radius: 4px;
      user-select: none;
      padding: 3px 6px;
      &.active {
        background-color: #fff;
        color: #000;
      }
    }
    select {
      font: inherit;
      padding: 5px;
      background: #fff;
      color: #000;
      border-radius: 4px;
      border: none;
      outline: none;
      cursor: pointer;
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

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
          ${this.midiInputIds.length > 0
        ? this.midiInputIds.map(
          (id) =>
            html`<option value=${id}>
                    ${this.midiDispatcher.getDeviceName(id)}
                  </option>`,
        )
        : html`<option value="">No devices found</option>`}
        </select>
      </div>
      <div id="grid">${this.renderPrompts()}</div>
      <play-pause-button .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>`;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}
