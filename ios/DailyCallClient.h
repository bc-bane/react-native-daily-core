#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <DailyCallClientSpec/DailyCallClientSpec.h>
#endif

@interface DailyCallClient : RCTEventEmitter
@end
