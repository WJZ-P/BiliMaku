import { styled } from "@linaria/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { globalLayers } from "../../styles/layers";
import { theme } from "../../styles/theme";
import type { TtsVoice } from "../../types/tts";

interface VoiceSearchSelectProps {
  /** 当前模型可以使用的全部音色。 */
  voices: readonly TtsVoice[];
  /** 当前已选中的音色编号。 */
  value: string;
  /** 没有可选音色时禁用搜索。 */
  disabled?: boolean;
  /** 选中音色后同步到统一 TTS 设置。 */
  onChange: (voiceId: string) => void;
}

const Root = styled.div`
  position: relative;
  width: 100%;
`;

const SearchControl = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 78%, transparent);
  border-radius: 4px;
  background:
    linear-gradient(110deg, color-mix(in srgb, ${theme.colors.highlight} 28%, transparent), transparent 48%),
    color-mix(in srgb, ${theme.colors.surface} 58%, transparent);
  color: ${theme.colors.textSecondary};
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
  backdrop-filter: blur(10px) saturate(1.2);
  transition:
    border-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    background-color ${theme.motion.fast};

  &:focus-within {
    border-color: ${theme.colors.brand};
    box-shadow:
      0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 12%, transparent),
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 60%, transparent);
  }

  &[data-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.56;
  }
`;

const SearchGlyph = styled.span`
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: ${theme.colors.brandDeep};
`;

const SearchInput = styled.input`
  min-width: 0;
  height: 100%;
  flex: 1;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textPrimary};
  font-family: inherit;
  font-size: 11px;
  font-weight: 680;

  &::placeholder {
    color: color-mix(in srgb, ${theme.colors.textMuted} 86%, transparent);
    font-weight: 620;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const ResultCount = styled.span`
  flex: 0 0 auto;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  font-weight: 760;
  white-space: nowrap;
`;

const Chevron = styled.span`
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: ${theme.colors.textMuted};
  transform: rotate(90deg);
  transition:
    color ${theme.motion.fast},
    transform 180ms cubic-bezier(0.18, 0.9, 0.32, 1.18);

  &[data-open="true"] {
    color: ${theme.colors.brandDeep};
    transform: rotate(-90deg);
  }
`;

const OptionList = styled.div`
  position: absolute;
  z-index: ${globalLayers.popover};
  top: calc(100% + 5px);
  right: 0;
  left: 0;
  max-height: 232px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 88%, transparent);
  border-radius: 5px;
  background:
    linear-gradient(138deg, color-mix(in srgb, ${theme.colors.highlight} 42%, transparent), transparent 52%),
    color-mix(in srgb, ${theme.colors.surface} 86%, transparent);
  box-shadow:
    0 14px 34px color-mix(in srgb, ${theme.colors.textPrimary} 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 74%, transparent);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
  backdrop-filter: blur(24px) saturate(1.35);
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, ${theme.colors.brand} 54%, transparent) transparent;
`;

const VoiceOption = styled.button`
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  border: 0;
  border-radius: 3px;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textPrimary};
  text-align: left;
  cursor: pointer;
  transition:
    color ${theme.motion.fast},
    background-color ${theme.motion.fast};

  &:hover,
  &[data-active="true"] {
    background: color-mix(in srgb, ${theme.colors.brandSoft} 72%, transparent);
    color: ${theme.colors.brandDeep};
  }

  &[aria-selected="true"] {
    box-shadow: inset 2px 0 0 ${theme.colors.brand};
  }
`;

const VoiceCopy = styled.span`
  display: grid;
  min-width: 0;
  gap: 3px;
`;

const VoiceName = styled.span`
  overflow: hidden;
  font-size: 11px;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const VoiceMeta = styled.span`
  overflow: hidden;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SelectedMark = styled.span`
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: ${theme.colors.brandDeep};
`;

const EmptyResult = styled.div`
  display: grid;
  min-height: 74px;
  place-items: center;
  padding: 12px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-weight: 660;
  text-align: center;
`;

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function getVoiceLabel(voice: TtsVoice) {
  return voice.language ? `${voice.name} · ${voice.language}` : voice.name;
}

/**
 * 自定义模型音色搜索组合框。
 *
 * 可按音色名称、模型内 ID 和语言搜索，同时保留方向键、回车与 Esc 操作。
 */
export function VoiceSearchSelect({ voices, value, disabled = false, onChange }: VoiceSearchSelectProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === value) ?? null,
    [value, voices],
  );
  const filteredVoices = useMemo(() => {
    const terms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return voices;

    return voices.filter((voice) => {
      const searchable = normalizeSearchText(`${voice.name} ${voice.id} ${voice.language}`);
      return terms.every((term) => searchable.includes(term));
    });
  }, [query, voices]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [voices]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filteredVoices.length - 1, 0)));
  }, [filteredVoices.length]);

  useEffect(() => {
    if (!open || filteredVoices.length === 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filteredVoices.length, listboxId, open]);

  const openMenu = () => {
    if (disabled) return;
    const selectedIndex = voices.findIndex((voice) => voice.id === value);
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const chooseVoice = (voice: TtsVoice) => {
    onChange(voice.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <Root
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <SearchControl data-disabled={disabled} onClick={() => inputRef.current?.focus()}>
        <SearchGlyph><Icon name="search" size={15} /></SearchGlyph>
        <SearchInput
          ref={inputRef}
          role="combobox"
          aria-label="搜索模型音色"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={open && filteredVoices.length > 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={disabled ? "当前模型没有可选音色" : "搜索音色名称、ID 或语言"}
          spellCheck={false}
          value={open ? query : selectedVoice ? getVoiceLabel(selectedVoice) : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (!open) openMenu();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) {
                openMenu();
                return;
              }
              setActiveIndex((index) => filteredVoices.length > 0
                ? (index + 1) % filteredVoices.length
                : 0);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                openMenu();
                return;
              }
              setActiveIndex((index) => filteredVoices.length > 0
                ? (index - 1 + filteredVoices.length) % filteredVoices.length
                : 0);
            } else if (event.key === "Enter" && open && filteredVoices[activeIndex]) {
              event.preventDefault();
              chooseVoice(filteredVoices[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <ResultCount aria-hidden="true">
          {open ? `${filteredVoices.length}/${voices.length}` : `${voices.length} 个`}
        </ResultCount>
        <Chevron data-open={open}><Icon name="chevron" size={13} /></Chevron>
      </SearchControl>

      {open ? (
        <OptionList id={listboxId} role="listbox" aria-label="模型音色搜索结果">
          {filteredVoices.length > 0 ? filteredVoices.map((voice, index) => {
            const selected = voice.id === value;
            return (
              <VoiceOption
                id={`${listboxId}-option-${index}`}
                key={voice.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-active={index === activeIndex}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseVoice(voice)}
              >
                <VoiceCopy>
                  <VoiceName>{voice.name}</VoiceName>
                  <VoiceMeta>{voice.language || "未标注语言"} · ID {voice.id}</VoiceMeta>
                </VoiceCopy>
                <SelectedMark>{selected ? <Icon name="check" size={15} /> : null}</SelectedMark>
              </VoiceOption>
            );
          }) : (
            <EmptyResult>没有匹配的音色，试试输入中文名、音色 ID 或语言。</EmptyResult>
          )}
        </OptionList>
      ) : null}
    </Root>
  );
}