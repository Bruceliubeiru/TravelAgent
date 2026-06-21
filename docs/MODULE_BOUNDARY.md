# Module Boundary

Allowed dependency direction:

- ops may depend on device
- ops may read core outputs
- h5 may read core outputs
- miniprogram may call travelGateway
- travelGateway may use the existing engine

Forbidden dependency direction:

- core must not depend on ops
- core must not depend on device
- miniprogram must not depend on device providers
- h5 must not depend on device providers
- booking must not depend on device providers

The default product flow must run without optional modules.
