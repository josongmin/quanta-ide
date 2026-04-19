export declare function useDebounce<T>(value: T, delayMs: number): T;
export declare function useDebouncedCallback<A extends unknown[], R>(fn: (...args: A) => R, delayMs: number): (...args: A) => void;
