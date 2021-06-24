export * from "@toi/toi";
import { NestedError } from "ts-nested-error";
import * as toi from "@toi/toi";
import validateCron from "cron-validate";
import v from "validator";
import { get, assign, isNil, isString } from "lodash";

type FirstParam<T extends (...args: unknown[]) => unknown> = Parameters<T>[0];
export type ValidateTo<T, I = unknown> = toi.Validator<I, T>;

// Need to refine the Partial type because it doesn't allow assignment to
// undefined, despite allowing keys to not exist.
type MyPartial<T> = {
	[K in keyof T]?: T[K] | undefined;
};

type IsStrCfg = MyPartial<{
	minLength: number;
	maxLength: number;
}>;

type IsCronCfg = Parameters<typeof validateCron>[1];

type IsNumCfg = MyPartial<{
	isInteger: boolean;
	min: number;
	max: number;
}>;

type IsURLCfg = MyPartial<v.IsURLOptions>;

const isAny: ValidateTo<unknown> = toi.any.is();
const isBool: ValidateTo<boolean> = toi.bool.is();
function isStr(config?: IsStrCfg): ValidateTo<string> {
	const minLength = config?.minLength ?? Number.MIN_VALUE;
	const maxLength = config?.maxLength ?? Number.MAX_VALUE;
	return toi.str.is().and(toi.str.length(minLength, maxLength));
}
function isCron(config?: IsCronCfg): ValidateTo<string> {
	return isStr({ minLength: 9 }).and(
		// TODO: Leverage error message from cron-validate
		toi.wrap(
			"cronExpression",
			toi.allow((str) => {
				if (!str) return true;
				try {
					// TODO Use the error messages
					return validateCron(str, config).isValid();
				} catch (ignored) {
					return false;
				}
			}, "invalid cron expression")
		)
	);
}
const baseIsNum = toi.num.is();
function isNum(config?: IsNumCfg): ValidateTo<number> {
	let v = baseIsNum;
	if (config?.isInteger) v = v.and(toi.num.integer());
	if (config?.min) {
		v = v.and(toi.num.min(config.min));
	} else if (config?.min === 0) {
		v = v.and(toi.num.min(0));
	}
	if (config?.max) {
		v = v.and(toi.num.max(config.max));
	} else if (config?.max === 0) {
		v = v.and(toi.num.max(0));
	}
	return v;
}
function isURL(opts: IsURLCfg = {}): ValidateTo<string> {
	return optional.str.nonempty().and(
		toi.wrap(
			"URL",
			toi.allow((i) => {
				if (!i) return true;
				if (!isString(i)) return false;
				return v.isURL(i, {
					require_tld: false,
					require_valid_protocol: false,
					allow_protocol_relative_urls: true,
					disallow_auth: true,
					...opts,
				});
			}, "is not a URL")
		)
	);
}
const isSemVer: ValidateTo<string> = optional.str.nonempty().and(
	toi.wrap(
		"SemVer",
		toi.allow((i) => {
			if (!i) return true;
			if (!isString(i)) return false;
			return v.isSemVer(i);
		}, "is not a Semantic Version")
	)
);
const isFilePath: ValidateTo<string> = optional(
	optional.str.nonempty().and(
		toi.wrap(
			"FilePath",
			toi.allow((i) => {
				if (isNil(i)) return true;
				if (!isString(i)) return false;
				return v.isAscii(i); // TODO Make this more valuable.
			}, "is not a path")
		)
	)
);

function isEnumValue<E extends object>(
	enumClass: E
): ValidateTo<string & keyof E> {
	const keys: (string & keyof E)[] = [];
	for (const key in enumClass) {
		if (typeof key === "string") {
			keys.push(key);
		}
	}
	return isStr({ minLength: 1 }).and(toi.any.values(...keys));
}

function or2<I, O1, O2>(
	validator1: toi.Validator<I, O1>,
	validator2: toi.Validator<I, O2>
): toi.Validator<I, O1 | O2> {
	// @ts-ignore
	return toi.wrap(
		"or",
		toi.transform((i) => {
			try {
				return validator1(i);
			} catch (e1) {
				try {
					return validator2(i);
				} catch (e2) {
					if (
						e1 instanceof toi.ValidationError &&
						e2 instanceof toi.ValidationError
					) {
						throw new toi.ValidationError("Neither case of 'or' applied", i, [
							e1,
							e2,
						]);
					} else {
						throw new NestedError(
							"Non-validation error while executing 'or' between validators",
							e1,
							e2
						);
					}
				}
			}
		})
	);
}

function extractField<M, K extends keyof M>(
	key: K,
	validator: ValidateTo<M[K]>
): toi.Validator<M, M[K]> {
	const base = toi.obj.is().and(
		toi.obj.keys(
			{
				[key]: validator,
			},
			{ lenient: true }
		)
	);
	return base.and(
		toi.wrap(
			`extract '${key}'`,
			toi.transform((i) => {
				if (key in i && typeof key === "string") {
					return i[key];
				} else {
					throw new toi.ValidationError(
						`Key must be a string, but is a ${typeof key}`,
						key
					);
				}
			})
		)
	);
}

export function or<I, O1, O2>(
	validator1: toi.Validator<I, O1>,
	validator2: toi.Validator<I, O2>
): toi.Validator<I, O1 | O2>;
export function or<I, O1, O2, O3>(
	validator1: toi.Validator<I, O1>,
	validator2: toi.Validator<I, O2>,
	validator3: toi.Validator<I, O3>
): toi.Validator<I, O1 | O2 | O3>;
export function or<I, O1, O2, O3, O4>(
	validator1: toi.Validator<I, O1>,
	validator2: toi.Validator<I, O2>,
	validator3: toi.Validator<I, O3>,
	validator4: toi.Validator<I, O4>
): toi.Validator<I, O1 | O2 | O3 | O4>;
export function or<I, O1, O2, O3, O4, O5>(
	validator1: toi.Validator<I, O1>,
	validator2: toi.Validator<I, O2>,
	validator3: toi.Validator<I, O3>,
	validator4: toi.Validator<I, O4>,
	validator5: toi.Validator<I, O5>
): toi.Validator<I, O1 | O2 | O3 | O4 | O5>;
export function or<I, O1, O2, O3 = never, O4 = never, O5 = never>(
	v1: toi.Validator<I, O1>,
	v2: toi.Validator<I, O2>,
	v3?: toi.Validator<I, O3>,
	v4?: toi.Validator<I, O4>,
	v5?: toi.Validator<I, O5>
): toi.Validator<I, O1 | O2 | O3 | O4 | O5> {
	let v: toi.Validator<I, O1 | O2 | O3 | O4 | O5> = or2(v1, v2);
	if (v3) v = or2(v, v3);
	if (v4) v = or2(v, v4);
	if (v5) v = or2(v, v5);
	return v;
}

export function required<I, O>(
	validator: toi.Validator<I, O>
): toi.Validator<I, O> {
	// @ts-ignore
	return toi.required().and(validator);
}

export namespace required {
	export function any(): ValidateTo<unknown> {
		return required(isAny);
	}

	export function obj<Y extends object>(
		keys: { [K in keyof Y]: ValidateTo<Y[K]> },
		missing?: (keyof Y)[]
	): ValidateTo<Y> {
		return required(
			toi.obj.is().and(toi.obj.keys(keys, { lenient: true, missing }))
		);
	}

	export namespace obj {
		export function focus<M, K extends keyof M = keyof M>(
			key: K,
			valueValidator: ValidateTo<M[K]>
		): ValidateTo<M[K]> {
			// @ts-ignore
			return required(extractField(key, valueValidator));
		}

		export function convertedTo<I extends object, O>(
			className: string,
			transformer: (i: I) => NonNullable<O>
		): ValidateTo<O> {
			// @ts-ignore
			return toi.wrap(`convert to "${className}"`, toi.transform(transformer));
		}

		export function partial<Y extends object>(
			keys: { [K in keyof Y]: ValidateTo<Y[K]> }
		): ValidateTo<MyPartial<Y>> {
			// @ts-ignore
			const yKeys: (keyof Y)[] = Object.keys(keys);
			return required(
				toi.obj.is().and(toi.obj.keys(keys, { lenient: true, missing: yKeys }))
			);
		}
	}

	export function value<O>(o: NonNullable<O>): ValidateTo<O> {
		return required(
			toi.wrap(
				"value",
				toi.allow<unknown, NonNullable<O>>(
					(i) => i === o,
					`input does not equal '${o}' (${typeof o})`
				)
			)
		);
	}

	export function bool(): ValidateTo<boolean> {
		return required(isBool);
	}

	export function str(config?: IsStrCfg): ValidateTo<string> {
		return required(isStr(config));
	}

	export namespace str {
		export function nonempty(): ReturnType<typeof required.str> {
			return required.str().and(toi.str.nonempty());
		}

		export function cron(config?: IsCronCfg): ValidateTo<string> {
			return required.str().and(isCron(config));
		}

		export function url(opts: IsURLCfg): ValidateTo<string> {
			return required(required.str().and(isURL(opts)));
		}

		export function semVer(): ValidateTo<string> {
			return required(required.str().and(isSemVer));
		}

		export function filepath(): ValidateTo<string> {
			return required(required.str().and(isFilePath));
		}
	}

	export function num(config?: IsNumCfg): ValidateTo<number> {
		return required(isNum(config));
	}

	export function enumValue<E extends object>(
		enumClass: E
	): ValidateTo<string & keyof E> {
		return required(isEnumValue(enumClass));
	}

	export function array<I>(itemValidator: ValidateTo<I>): ValidateTo<I[]> {
		return required(
			toi.array.is().and(toi.array.items(required(itemValidator)))
		);
	}

	export namespace array {
		export function elemConvertedTo<O, I>(
			className: string,
			transformer: (i: I) => O,
			itemValidator?: ValidateTo<I>
		): ValidateTo<O[]> {
			return toi.required().and(
				toi.array.is().and(
					toi.array.items(itemValidator || toi.required()).and(
						toi.wrap(
							`transform elements to "${className}"`,
							toi.transform((i) => i.map((j) => transformer(j as I)))
						)
					)
				)
			);
		}

		export function compacted<I>(): toi.Validator<
			(I | null | undefined)[],
			NonNullable<I>[]
		> {
			return required(
				toi.wrap(
					`compact array`,
					toi.transform(
						(i) => (i?.filter((v) => !isNil(v)) as NonNullable<I>[]) || []
					)
				)
			);
		}
	}
}

export function optional<I, O>(
	validator: toi.Validator<I, O>
): toi.Validator<I, O> {
	return validator;
}

export namespace optional {
	export function any(): ValidateTo<unknown> {
		return optional(isAny);
	}

	export function bool(): ValidateTo<boolean> {
		return optional(isBool);
	}

	export function str(config?: IsStrCfg): ValidateTo<string> {
		return optional(isStr(config));
	}

	export namespace str {
		export function nonempty(): ReturnType<typeof optional.str> {
			return optional.str().and(toi.str.nonempty());
		}

		export function cron(config?: IsCronCfg): ValidateTo<string> {
			return optional.str().and(isCron(config));
		}

		export function url(opts: IsURLCfg): ValidateTo<string> {
			return optional.str().and(isURL(opts));
		}

		export function semVer(): ValidateTo<string> {
			return optional.str().and(isSemVer);
		}

		export function filepath(): ValidateTo<string> {
			return optional.str().and(isFilePath);
		}
	}

	export function num(config?: IsNumCfg): ValidateTo<number> {
		return optional(isNum(config));
	}

	export function enumValue<E extends object>(
		enumClass: E
	): ValidateTo<string & keyof E> {
		return optional(isEnumValue(enumClass));
	}

	export function value<O>(o: O): ValidateTo<O> {
		return optional(
			toi.wrap(
				"value",
				toi.allow((i) => i === o, `input does not equal '${o}' (${typeof o})`)
			)
		);
	}

	export function obj<X extends object>(
		keys: { [K in keyof X]: ValidateTo<X[K]> },
		missing?: (keyof X)[]
	): ValidateTo<X> {
		return optional(
			toi.obj.is().and(toi.obj.keys(keys, { lenient: true, missing }))
		);
	}

	export namespace obj {
		export function focus<M extends object>(
			key: keyof M,
			valueValidator: ValidateTo<M[keyof M]>
		): ValidateTo<M[keyof M]> {
			return toi.optional().and(
				toi.obj.is().and(
					toi.obj.keys({ [key]: valueValidator }, { lenient: true }).and(
						toi.wrap(
							`extract '${key}'`,
							toi.transform((i) => get(i, key))
						)
					)
				)
			);
		}

		export function convertedTo<I extends object, O>(
			className: string,
			transformer: (i: I) => O
		): ValidateTo<O> {
			return toi.optional().and(
				toi.wrap(
					`convert to "${className}"`,
					toi.transform((i) => transformer(i as I))
				)
			);
		}

		export function partial<Y>(
			keys: { [K in keyof Y]: ValidateTo<Y[K]> }
		): ValidateTo<MyPartial<Y>> {
			// @ts-ignore
			const yKeys: (keyof Y)[] = Object.keys(keys); // C'mon, TypeScript, you can do this...
			return optional(
				toi.obj.is().and(toi.obj.keys(keys, { lenient: true, missing: yKeys }))
			);
		}
	}

	export function array<I>(itemValidator: ValidateTo<I>): ValidateTo<I[]> {
		return optional(
			toi.array.is().and(toi.array.items(toi.optional().and(itemValidator)))
		);
	}

	export namespace array {
		export function elemConvertedTo<O, I = unknown>(
			className: string,
			transformer: (i: I | null | undefined) => O,
			itemValidator?: ValidateTo<I>
		): ValidateTo<O[]> {
			return toi.array.is().and(
				toi.array.items(itemValidator || toi.optional()).and(
					toi.wrap(
						`transform elements to "${className}"`,
						toi.transform((i) => i.map((i) => transformer(i)))
					)
				)
			);
		}

		export function compacted<I>(): toi.Validator<I[], NonNullable<I>[]> {
			return toi.wrap(
				`compact array`,
				toi.transform((i) => i?.filter((v) => !isNil(v)) as NonNullable<I>[])
			);
		}
	}
}
