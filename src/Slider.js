'use strict';

import React, {
  PureComponent,
} from "react";

import {
  Animated,
  Image,
  StyleSheet,
  PanResponder,
  View,
  Easing,
  ViewPropTypes,
} from "react-native";

import PropTypes from 'prop-types';

var TRACK_SIZE = 4;
var THUMB_SIZE = 20;

function Rect(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.containsPoint = function(x, y) {
  return (x >= this.x
          && y >= this.y
          && x <= this.x + this.width
          && y <= this.y + this.height);
};

var DEFAULT_ANIMATION_CONFIGS = {
  spring : {
    friction : 7,
    tension  : 100
  },
  timing : {
    duration : 150,
    easing   : Easing.inOut(Easing.ease),
    delay    : 0
  },
  // decay : { // This has a serious bug
  //   velocity     : 1,
  //   deceleration : 0.997
  // }
};

export default class Slider extends PureComponent {
  static propTypes = {
    /**
     * Initial value of the slider. The value should be between minimumValue
     * and maximumValue, which default to 0 and 1 respectively.
     * Default value is 0.
     *
     * *This is not a controlled component*, e.g. if you don't update
     * the value, the component won't be reset to its inital value.
     */
    value: PropTypes.number,

    /**
     * If true the user won't be able to move the slider.
     * Default value is false.
     */
    disabled: PropTypes.bool,

    /**
     * Initial minimum value of the slider. Default value is 0.
     */
    minimumValue: PropTypes.number,

    /**
     * Initial maximum value of the slider. Default value is 1.
     */
    maximumValue: PropTypes.number,

    /**
     * Step value of the slider. The value should be between 0 and
     * (maximumValue - minimumValue). Default value is 0.
     */
    step: PropTypes.number,

    /**
     * The color used for the track to the left of the button. Overrides the
     * default blue gradient image.
     */
    minimumTrackTintColor: PropTypes.string,

    /**
     * The color used for the track to the right of the button. Overrides the
     * default blue gradient image.
     */
    maximumTrackTintColor: PropTypes.string,

    /**
     * The color used for the thumb.
     */
    thumbTintColor: PropTypes.string,

    /**
     * The size of the touch area that allows moving the thumb.
     * The touch area has the same center has the visible thumb.
     * This allows to have a visually small thumb while still allowing the user
     * to move it easily.
     * The default is {width: 40, height: 40}.
     */
    thumbTouchSize: PropTypes.shape(
      {width: PropTypes.number, height: PropTypes.number}
    ),

    /**
     * Callback continuously called while the user is dragging the slider.
     */
    onValueChange: PropTypes.func,

    /**
     * Callback called when the user starts changing the value (e.g. when
     * the slider is pressed).
     */
    onSlidingStart: PropTypes.func,

    /**
     * Callback called when the user finishes changing the value (e.g. when
     * the slider is released).
     */
    onSlidingComplete: PropTypes.func,

    /**
     * The style applied to the slider container.
     */
    style: ViewPropTypes.style,

    /**
     * The style applied to the track.
     */
    trackStyle: ViewPropTypes.style,

    /**
     * The style applied to the thumb.
     */
    thumbStyle: ViewPropTypes.style,

    /**
     * Sets an image for the thumb.
     */
    thumbImage: Image.propTypes.source,

    /**
    * Sets an element for the thumb.
    */
   thumbElement: PropTypes.element,

    /**
     * Set this to true to visually see the thumb touch rect in green.
     */
    debugTouchArea: PropTypes.bool,

    /**
     * Set to true to animate values with default 'timing' animation type
     */
    animateTransitions : PropTypes.bool,

    /**
     * Custom Animation type. 'spring' or 'timing'.
     */
    animationType : PropTypes.oneOf(['spring', 'timing']),

    /**
     * Used to configure the animation parameters.  These are the same parameters in the Animated library.
     */
    animationConfig : PropTypes.object,


    /**
     * The number of markes across the tracker
     */
    numOfMarkers: PropTypes.number,

    /**
     * The style applied to the markers.
     */
    markerStyle: ViewPropTypes.style,

    /**
     * Callback called when the user presses a marker. It returns the marker's index.
     */
    onMarkerPress: PropTypes.func,

    /**
     * Callback called when markers are set and user slides the thumb. Returns the rounded number.
     */
    onMarkerChange: PropTypes.func,
  };

  static defaultProps = {
    value: 0,
    minimumValue: 0,
    maximumValue: 1,
    step: 0,
    minimumTrackTintColor: '#3f3f3f',
    maximumTrackTintColor: '#b3b3b3',
    thumbTintColor: '#343434',
    thumbTouchSize: {width: 40, height: 40},
    debugTouchArea: false,
    animationType: 'timing',
    numOfMarkers: 0
  };

  state = {
    containerSize: {width: 0, height: 0},
    trackSize: {width: 0, height: 0},
    thumbSize: {width: 0, height: 0},
    allMeasured: false,
    value: new Animated.Value(this.props.value),
  };

  componentWillMount() {
    let { minimumValue, maximumValue} = this.props;
    if (this.props.numOfMarkers > 1) {
      minimumValue = 0;
      maximumValue = this.props.numOfMarkers - 1;
    }
    this.setState({ minimumValue, maximumValue })

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._handleStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: this._handleMoveShouldSetPanResponder,
      onPanResponderGrant: this._handlePanResponderGrant,
      onPanResponderMove: this._handlePanResponderMove,
      onPanResponderRelease: this._handlePanResponderEnd,
      onPanResponderTerminationRequest: this._handlePanResponderRequestEnd,
      onPanResponderTerminate: this._handlePanResponderEnd,
    });
  };

  componentWillReceiveProps(nextProps) {
    var newValue = nextProps.value;

    if (this.props.value !== newValue) {
      if (this.props.animateTransitions) {
        this._setCurrentValueAnimated(newValue);
      }
      else {
        this._setCurrentValue(newValue);
      }
    }
  };

  render() {
    var {
      minimumTrackTintColor,
      maximumTrackTintColor,
      thumbTintColor,
      thumbImage,
      thumbElement,
      styles,
      style,
      trackStyle,
      thumbStyle,
      debugTouchArea,
      onValueChange,
      thumbTouchSize,
      animationType,
      animateTransitions,
      numOfMarkers,
      markerStyle,
      onMarkerPress,
      ...other
    } = this.props;
    var {value, containerSize, trackSize, thumbSize, allMeasured, minimumValue, maximumValue} = this.state;
    var mainStyles = styles || defaultStyles;
    var thumbLeft = value.interpolate({
      inputRange: [minimumValue, maximumValue],
      outputRange: [0, containerSize.width - thumbSize.width],
      //extrapolate: 'clamp',
    });
    var valueVisibleStyle = {};
    if (!allMeasured) {
      valueVisibleStyle.opacity = 0;
    }

    var minimumTrackStyle = {
      position: 'absolute',
      width: Animated.add(thumbLeft, thumbSize.width / 2),
      backgroundColor: minimumTrackTintColor,
      marginLeft: numOfMarkers > 1 ? thumbSize.width / 2 : 0,
      ...valueVisibleStyle
    };

    const trackMargins = {
      marginLeft: numOfMarkers > 1 ? thumbSize.width / 2 : 0,
      marginRight: numOfMarkers > 1 ? thumbSize.width / 2 : 0,
    }

    var touchOverflowStyle = this._getTouchOverflowStyle();

    return (
      <View {...other} style={[mainStyles.container, style]} onLayout={this._measureContainer}>
        <View
          style={[{backgroundColor: maximumTrackTintColor,}, mainStyles.track, trackMargins, trackStyle]}
          renderToHardwareTextureAndroid={true}
          onLayout={this._measureTrack} />
        <Animated.View
          renderToHardwareTextureAndroid={true}
          style={[mainStyles.track, trackStyle, minimumTrackStyle]} />
        {this._renderMarkers()}
        <Animated.View
          onLayout={this._measureThumb}
          renderToHardwareTextureAndroid={true}
          style={[
            {backgroundColor: thumbTintColor},
            mainStyles.thumb, thumbStyle,
            {
              transform: [
                { translateX: thumbLeft },
                { translateY: 0 }
              ],
              ...valueVisibleStyle
            }
          ]}
        >
          {this._renderThumb()}
        </Animated.View>
        <View
          renderToHardwareTextureAndroid={true}
          style={[defaultStyles.touchArea, touchOverflowStyle]}
          {...this._panResponder.panHandlers}>
          {debugTouchArea === true && numOfMarkers > 1 && this._renderDebugMarkersTouchRect(numOfMarkers)}
          {debugTouchArea === true && this._renderDebugThumbTouchRect(thumbLeft)}
        </View>
      </View>
    );
  };

  _getPropsForComponentUpdate(props) {
    var {
      value,
      onValueChange,
      onSlidingStart,
      onSlidingComplete,
      style,
      trackStyle,
      thumbStyle,
      ...otherProps,
    } = props;

    return otherProps;
  };

  _handleStartShouldSetPanResponder = (e: Object, /*gestureState: Object*/): boolean => {
    // Should we become active when the user presses down on the thumb?
    const thumbTouched = this._thumbHitTest(e);
    if (!thumbTouched && this.props.numOfMarkers > 1) {
      const markersHitTest = this._markersHitTest(e);

      const selectedMarker = markersHitTest.indexOf(true);

      if (selectedMarker > -1 ) {
        this._slideToClosest(selectedMarker);
        this.props.onMarkerPress && this.props.onMarkerPress(selectedMarker);
      }
    }
    return thumbTouched;
  };

  _handleMoveShouldSetPanResponder(/*e: Object, gestureState: Object*/): boolean {
    // Should we become active when the user moves a touch over the thumb?
    return false;
  };

  _handlePanResponderGrant = (e: Object/*, gestureState: Object*/) => {
    this._previousLeft = this._getThumbLeft(this._getCurrentValue());
    this._fireChangeEvent('onSlidingStart');
  };

  _handlePanResponderMove = (e: Object, gestureState: Object) => {
    if (this.props.disabled) {
      return;
    }

    this._setCurrentValue(this._getValue(gestureState));
    this._fireChangeEvent('onValueChange');
  };

  _handlePanResponderRequestEnd(e: Object, gestureState: Object) {
    // Should we allow another component to take over this pan?
    return false;
  };

  _handlePanResponderEnd = (e: Object, gestureState: Object) => {
    if (this.props.disabled) {
      return;
    }

    this._setCurrentValue(this._getValue(gestureState));
    this._fireChangeEvent('onSlidingComplete');

    if (this.props.numOfMarkers > 1) {
      this._slideToClosest()
    }
  };

  _measureContainer = (x: Object) => {
    this._handleMeasure('containerSize', x);
  };

  _measureTrack = (x: Object) => {
    this._handleMeasure('trackSize', x);
  };

  _measureThumb = (x: Object) => {
    this._handleMeasure('thumbSize', x);
  };

  _handleMeasure = (name: string, x: Object) => {
    var {width, height} = x.nativeEvent.layout;
    var size = {width: width, height: height};

    var storeName = `_${name}`;
    var currentSize = this[storeName];
    if (currentSize && width === currentSize.width && height === currentSize.height) {
      return;
    }
    this[storeName] = size;

    if (this._containerSize && this._trackSize && this._thumbSize) {
      this.setState({
        containerSize: this._containerSize,
        trackSize: this._trackSize,
        thumbSize: this._thumbSize,
        allMeasured: true,
      })
    }
  };

  _getRatio = (value: number) => {
    return (value - this.state.minimumValue) / (this.state.maximumValue - this.state.minimumValue);
  };

  _getThumbLeft = (value: number) => {
    var ratio = this._getRatio(value);
    return ratio * (this.state.containerSize.width - this.state.thumbSize.width);
  };

  _getMarkerLeft = (i: number) => {
    var ratio = i / (this.props.numOfMarkers - 1)
    return ratio * (this.state.containerSize.width - this.state.thumbSize.width);
  }

  _getValue = (gestureState: Object) => {
    var length = this.state.containerSize.width - this.state.thumbSize.width;
    var thumbLeft = this._previousLeft + gestureState.dx;

    var ratio = thumbLeft / length;

    if (this.props.step) {
      return Math.max(this.state.minimumValue,
        Math.min(this.state.maximumValue,
          this.state.minimumValue + Math.round(ratio * (this.state.maximumValue - this.state.minimumValue) / this.props.step) * this.props.step
        )
      );
    } else {
      return Math.max(this.state.minimumValue,
        Math.min(this.state.maximumValue,
          ratio * (this.state.maximumValue - this.state.minimumValue) + this.state.minimumValue
        )
      );
    }
  };

  _getCurrentValue = () => {
    return this.state.value.__getValue();
  };

  _setCurrentValue = (value: number) => {
    this.state.value.setValue(value);
  };

  _setCurrentValueAnimated = (value: number) => {
    var animationType   = this.props.animationType;
    var animationConfig = Object.assign(
      {},
      DEFAULT_ANIMATION_CONFIGS[animationType],
      this.props.animationConfig,
      {toValue : value}
    );

    Animated[animationType](this.state.value, animationConfig).start();
  };

  _fireChangeEvent = (event) => {
    if (this.props[event]) {
      this.props[event](this._getCurrentValue());
    }
  };

  _slideToClosest = (value) => {
    const val = value !== undefined ? value : this._getCurrentValue()
    const roundedValue = Math.round(val)
    console.log('_slideToClosest ', roundedValue)

    if (this.props.animateTransitions) {
      this._setCurrentValueAnimated(roundedValue);
    }
    else {
      this._setCurrentValue(roundedValue);
    }

    if (this.props.onMarkerChange) {
      this.props.onMarkerChange(roundedValue)
    }
  }

  _getTouchOverflowSize = () => {
    var state = this.state;
    var props = this.props;

    var size = {};
    if (state.allMeasured === true) {
      size.width = Math.max(0, props.thumbTouchSize.width - state.thumbSize.width);
      size.height = Math.max(0, props.thumbTouchSize.height - state.containerSize.height);
    }

    return size;
  };

  _getTouchOverflowStyle = () => {
    var {width, height} = this._getTouchOverflowSize();

    var touchOverflowStyle = {};
    if (width !== undefined && height !== undefined) {
      var verticalMargin = -height / 2;
      touchOverflowStyle.marginTop = verticalMargin;
      touchOverflowStyle.marginBottom = verticalMargin;

      var horizontalMargin = -width / 2;
      touchOverflowStyle.marginLeft = horizontalMargin;
      touchOverflowStyle.marginRight = horizontalMargin;
    }

    if (this.props.debugTouchArea === true) {
      touchOverflowStyle.backgroundColor = 'orange';
      touchOverflowStyle.opacity = 0.5;
    }

    return touchOverflowStyle;
  };

  _thumbHitTest = (e: Object) => {
    var nativeEvent = e.nativeEvent;
    var thumbTouchRect = this._getThumbTouchRect();
    return thumbTouchRect.containsPoint(nativeEvent.locationX, nativeEvent.locationY);
  };

  _markersHitTest = (e: Object) => {
    const nativeEvent = e.nativeEvent;
    const markersTouchRectArray: Array<any> = this._getMarkersTouchRect();

    return markersTouchRectArray.map((markerTouchRect) => 
      markerTouchRect.containsPoint(nativeEvent.locationX, nativeEvent.locationY)
    )
  };

  _getThumbTouchRect = () => {
    var state = this.state;
    var props = this.props;
    var touchOverflowSize = this._getTouchOverflowSize();

    return new Rect(
      touchOverflowSize.width / 2 + this._getThumbLeft(this._getCurrentValue()) + (state.thumbSize.width - props.thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 + (state.containerSize.height - props.thumbTouchSize.height) / 2,
      props.thumbTouchSize.width,
      props.thumbTouchSize.height
    );
  };

  _getMarkersTouchRect = () => {
    const markersRect = []
    for(const i = 0; i < this.props.numOfMarkers; i++) {
      markersRect.push(this._getMarkerTouchRect(i))
    }
    return markersRect
  }

  _getMarkerTouchRect = (i: number) => {
    var state = this.state;
    var props = this.props;
    var touchOverflowSize = this._getTouchOverflowSize();

    return new Rect(
      touchOverflowSize.width / 2 + this._getMarkerLeft(i) + (state.thumbSize.width - props.thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 + (state.containerSize.height - props.thumbTouchSize.height) / 2,
      props.thumbTouchSize.width,
      props.thumbTouchSize.height
    );
  };

  _renderDebugThumbTouchRect = (thumbLeft) => {
    var thumbTouchRect = this._getThumbTouchRect();
    var positionStyle = {
      left: thumbLeft,
      top: thumbTouchRect.y,
      width: thumbTouchRect.width,
      height: thumbTouchRect.height,
    };

    return (
      <Animated.View
        style={[defaultStyles.debugThumbTouchArea, positionStyle]}
        pointerEvents='none'
      />
    );
  };

  _renderDebugMarkersTouchRect = (numOfMarkers: number) => {

    const markers = []
    for (const i = 0; i < numOfMarkers; i++) {
      const markerLeft = this._getMarkerLeft(i);
      var markerTouchRect = this._getThumbTouchRect(i);
      var positionStyle = {
        left: markerLeft,
        top: markerTouchRect.y,
        width: markerTouchRect.width,
        height: markerTouchRect.height,
      };
      markers.push(
        <View
          key={i}
          style={[defaultStyles.debugMarkerTouchArea, positionStyle]}
          pointerEvents='none'
      />
      )
    }
    return markers;
  };

  _renderThumb = () => {
    var {thumbImage, thumbElement} = this.props;

    if (thumbElement) return thumbElement;

    if (!thumbImage) return;

    return <Image source={thumbImage} />;
  };

  _renderMarkers = () => {
    const {numOfMarkers, markerStyle} = this.props
    if (numOfMarkers < 2) return null

    var {thumbSize} = this.state;

    const outerStyle = {
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      width: thumbSize.width,
      height: thumbSize.height,
    }

    const markers = []
    for(const i=0; i<numOfMarkers; i++) {
      markers.push(
        <View key={i} style={outerStyle}>
          <View  style={[defaultStyles.markerStyle, markerStyle]} />
        </View>
      )
    }
    const containerStyle = {
      position: 'absolute',
      flexDirection: 'row',
      justifyContent: 'space-between',
      left: 0,
      right: 0,
    }
    return (
      <View style={containerStyle} renderToHardwareTextureAndroid={true}>
        {markers}
      </ View >

    )
  }
}

var defaultStyles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_SIZE,
    borderRadius: TRACK_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  touchArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  debugThumbTouchArea: {
    position: 'absolute',
    backgroundColor: 'green',
    opacity: 0.5,
  },
  debugMarkerTouchArea: {
    position: 'absolute',
    backgroundColor: 'red',
    opacity: 0.5,
  },
  markerStyle: {
    width: THUMB_SIZE / 2,
    height: THUMB_SIZE / 2,
    borderRadius: THUMB_SIZE / 4,
    backgroundColor: '#b3b3b3',
  }
});
