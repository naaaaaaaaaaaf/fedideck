import { LuPlus, LuMinus } from 'react-icons/lu';

export interface PollOptionDraft {
    id: string;
    text: string;
}

export interface PollDurationOption {
    value: number;
    label: string;
}

const DEFAULT_DURATION_OPTIONS: PollDurationOption[] = [
    { value: 300, label: '5分' },
    { value: 1800, label: '30分' },
    { value: 3600, label: '1時間' },
    { value: 21600, label: '6時間' },
    { value: 86400, label: '1日' },
    { value: 259200, label: '3日' },
    { value: 604800, label: '7日' },
];

interface ComposePollFormProps {
    pollOptions: PollOptionDraft[];
    pollExpiresIn: number;
    pollMultiple: boolean;
    durationOptions?: PollDurationOption[];
    maxOptions: number;
    minOptions: number;
    onAddOption: () => void;
    onRemoveOption: (id: string) => void;
    onUpdateOption: (id: string, value: string) => void;
    onChangeExpiresIn: (value: number) => void;
    onChangeMultiple: (value: boolean) => void;
}

/**
 * Poll form component for compose modal
 */
export function ComposePollForm({
    pollOptions,
    pollExpiresIn,
    pollMultiple,
    durationOptions = DEFAULT_DURATION_OPTIONS,
    maxOptions,
    minOptions,
    onAddOption,
    onRemoveOption,
    onUpdateOption,
    onChangeExpiresIn,
    onChangeMultiple,
}: ComposePollFormProps) {
    return (
        <fieldset className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <legend className="sr-only">投票設定</legend>
            <div className="space-y-2 mb-3">
                {pollOptions.map((option, index) => (
                    <div key={option.id} className="flex gap-2">
                        <label htmlFor={`poll-option-${option.id}`} className="sr-only">
                            選択肢 {index + 1}
                        </label>
                        <input
                            id={`poll-option-${option.id}`}
                            type="text"
                            value={option.text}
                            onChange={(e) => onUpdateOption(option.id, e.target.value)}
                            placeholder={`選択肢 ${index + 1}`}
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        {pollOptions.length > minOptions && (
                            <button
                                onClick={() => onRemoveOption(option.id)}
                                className="p-2 bg-slate-700 hover:bg-red-600/50 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                aria-label={`選択肢 ${index + 1} を削除`}
                            >
                                <LuMinus className="w-4 h-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {pollOptions.length < maxOptions && (
                <button
                    onClick={onAddOption}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <LuPlus className="w-4 h-4" aria-hidden="true" />
                    選択肢を追加（最大{maxOptions}）
                </button>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-700">
                <div className="flex items-center gap-2">
                    <label htmlFor="poll-duration-select" className="text-sm text-slate-400">
                        有効期限:
                    </label>
                    <select
                        id="poll-duration-select"
                        value={pollExpiresIn}
                        onChange={(e) => onChangeExpiresIn(Number(e.target.value))}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                        {durationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={pollMultiple}
                        onChange={(e) => onChangeMultiple(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700"
                    />
                    複数選択可
                </label>
            </div>
        </fieldset>
    );
}
