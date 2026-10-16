#import <React/RCTViewComponentView.h>
#import <react/renderer/components/DailyCallClientSpec/ComponentDescriptors.h>
#import <react/renderer/components/DailyCallClientSpec/Props.h>
#import <react/renderer/components/DailyCallClientSpec/RCTComponentViewHelpers.h>

#import "react_native_daily_core-Swift.h"

using namespace facebook::react;

@interface DailyVideoView : RCTViewComponentView
@end

@implementation DailyVideoView {
  DailyVideoHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<DailyVideoViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _host = [[DailyVideoHost alloc] initWithFrame:self.bounds];
    _host.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<DailyVideoViewProps const>(props);
  _host.clientId = newProps.clientId;
  _host.participantId = [NSString stringWithUTF8String:newProps.participantId.c_str()];
  _host.videoSource = [NSString stringWithUTF8String:newProps.videoSource.c_str()];
  [_host setMirrored:newProps.mirror];
  [_host setObjectFit:[NSString stringWithUTF8String:newProps.objectFit.c_str()]];
  [_host refreshTrack];
  [super updateProps:props oldProps:oldProps];
}

@end

Class<RCTComponentViewProtocol> DailyVideoViewCls(void)
{
  return DailyVideoView.class;
}
