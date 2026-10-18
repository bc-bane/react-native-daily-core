#import <React/RCTBridgeModule.h>

@interface DailyCallClientRuntime : NSObject <RCTBridgeModule>
@end

@implementation DailyCallClientRuntime

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (void)invalidate
{
  [[NSNotificationCenter defaultCenter] postNotificationName:@"DailyCallClientModuleUnload" object:nil];
}

@end
