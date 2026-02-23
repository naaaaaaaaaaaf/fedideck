import type { Visibility } from '../../hooks/usePostSubmit';
import { getVisibilityOptions } from '../../utils/statusVisibility';

const VISIBILITY_OPTIONS = getVisibilityOptions();

interface ComposeVisibilitySelectorProps {
    visibility: Visibility;
    isEditMode: boolean;
    onChange: (visibility: Visibility) => void;
}

/**
 * Visibility selector component for compose modal
 */
export function ComposeVisibilitySelector({
    visibility,
    isEditMode,
    onChange,
}: ComposeVisibilitySelectorProps) {
    return (
        <fieldset className="mt-3">
            <legend className="text-sm text-slate-400 mb-2">
                公開範囲
                {isEditMode && (
                    <span className="ml-2 text-xs text-amber-400">(編集中は変更できません)</span>
                )}
            </legend>
            <div className="grid grid-cols-2 gap-2">
                {VISIBILITY_OPTIONS.map((option) => (
                    <label
                        key={option.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                            visibility === option.value
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                        } ${isEditMode ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                        <input
                            type="radio"
                            name="visibility"
                            value={option.value}
                            checked={visibility === option.value}
                            onChange={() => !isEditMode && onChange(option.value)}
                            disabled={isEditMode}
                            className="sr-only"
                        />
                        <span className="text-lg">{option.icon}</span>
                        <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-xs text-slate-400">{option.description}</div>
                        </div>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
