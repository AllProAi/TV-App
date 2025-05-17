# ADR 001: Use Vanilla JavaScript Instead of Framework

## Status
Accepted

## Context
When developing the MemoryStream TV application for the Synamedia Senza platform, we needed to decide whether to use a modern JavaScript framework (React, Vue, Angular) or vanilla JavaScript.

Key considerations included:
- Performance requirements for TV platforms (which often have limited resources)
- Integration complexity with the Senza platform
- Development speed and maintainability
- Bundle size and load time optimization
- Team expertise and preferences

## Decision
We decided to use vanilla JavaScript without a framework for the TV application. The mobile companion app also uses vanilla JavaScript for consistency and code reuse.

## Rationale

### Performance
- TV platforms have limited resources and can struggle with the overhead of frameworks
- Vanilla JS allows for more control over performance optimizations
- Avoids the runtime overhead of virtual DOM reconciliation
- Results in smaller bundle sizes and faster startup times

### Integration
- Simpler integration with the Senza platform SDK
- Reduces potential conflicts with platform-specific libraries
- More flexibility for platform-specific optimizations

### Maintainability
- Focused code with fewer abstractions
- Clear data flow without framework-specific patterns
- Modular component architecture still maintained through ES6 classes

### Size Optimization
- Smaller bundle size (critical for TV platforms)
- No framework runtime overhead
- Only includes exactly what's needed

## Consequences

### Positive
- Better performance on resource-constrained TV platforms
- Smaller bundle sizes
- More direct control over the rendering process
- Simplified debugging without framework abstractions

### Negative
- More manual DOM manipulation
- No built-in state management
- More code for common UI patterns
- Potentially slower development for complex UI interactions

### Mitigations
- Created a modular component architecture using ES6 classes
- Implemented simple pub/sub event system for component communication
- Used custom RemoteNavigation system for TV navigation
- Maintained consistent patterns across components

## Alternatives Considered

### React
- Pros: Component model, widespread adoption, strong ecosystem
- Cons: Bundle size, runtime overhead, potential performance issues on TV

### Vue
- Pros: Smaller than React, good performance, easy learning curve
- Cons: Still adds overhead, less direct control than vanilla JS

### Preact
- Pros: React-compatible API, much smaller size
- Cons: Still adds abstraction layer, potential compatibility issues

## References
- Senza Platform Documentation
- TV Performance Benchmarks
- Bundle Size Analysis 