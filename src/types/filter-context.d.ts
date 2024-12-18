interface FilterContext {
    filter<T>(callback: (value: T, index: number, array: T[]) => boolean): T[];
    map<T, U>(callback: (value: T, index: number, array: T[]) => U): U[];
    reduce<T>(callback: (accumulator: T, current: T, index: number, array: T[]) => T, initialValue?: T): T;
    // Add more method definitions...
} 