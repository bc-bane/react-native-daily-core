#import "DailyCallClient.h"

#import "react_native_daily_core-Swift.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <DailyCallClientSpec/DailyCallClientSpec.h>
#import <React/RCTComponentViewProtocol.h>

Class<RCTComponentViewProtocol> DailyVideoViewCls(void);
#endif

@implementation DailyCallClient {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(DailyCallClient)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  if (self = [super init]) {
#ifdef RCT_NEW_ARCH_ENABLED
    // Force-link DailyVideoView.o (Fabric registration uses NSClassFromString).
    (void)DailyVideoViewCls();
#endif
    __weak DailyCallClient *weakSelf = self;
    [DailyClientRegistry shared].eventSink = ^(NSNumber *clientId, NSString *type, NSString *payloadJson) {
      DailyCallClient *strongSelf = weakSelf;
      if (strongSelf == nil || !strongSelf->_hasListeners) {
        return;
      }
      [strongSelf sendEventWithName:@"DailyCallClientEvent"
                               body:@{
                                 @"clientId" : clientId,
                                 @"type" : type,
                                 @"payloadJson" : payloadJson,
                               }];
    };
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"DailyCallClientEvent" ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

RCT_EXPORT_METHOD(createClient:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      resolve(@([[DailyClientRegistry shared] createOnMain]));
    } @catch (NSException *exception) {
      reject(@"E_DAILY", exception.reason, nil);
    }
  });
}

RCT_EXPORT_METHOD(destroyClient:(double)clientId)
{
  [[DailyClientRegistry shared] destroy:(int)clientId];
}

- (void)invalidate
{
  [[DailyClientRegistry shared] destroyAll];
  [DailyClientRegistry shared].eventSink = nil;
  [super invalidate];
}

RCT_EXPORT_METHOD(perform:(double)clientId
                  action:(NSString *)action
                  payloadJson:(NSString *)payloadJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[DailyClientRegistry shared] perform:(int)clientId
                                 action:action
                            payloadJson:payloadJson
                             completion:^(NSString *json, NSString *error) {
                               if (error != nil) {
                                 reject(@"E_DAILY", error, nil);
                               } else {
                                 resolve(json ?: @"{}");
                               }
                             }];
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName)
{
  [super addListener:eventName];
}

RCT_EXPORT_METHOD(removeListeners:(double)count)
{
  [super removeListeners:(NSInteger)count];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeDailyCallClientSpecJSI>(params);
}
#endif

@end
