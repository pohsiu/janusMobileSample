import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import JanusHelper from './utils/janus-helper';
import {
  RTCView,
} from 'react-native-webrtc';

const styles = StyleSheet.create({
  selfView: {
    position:'absolute',
    bottom: 0,
    right: 0,
    aspectRatio: 3/4,
    height: 100,
    borderWidth: 1,
    borderColor: 'black',
  },
  remoteView: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height/3,
    borderWidth: 1,
    borderColor: 'red',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});

class Main extends React.Component {
  constructor() {
    super();
    this.state = {
      localStream: undefined,
      remoteList: {},
    }
  }
  componentDidMount() {
    this.janus = new JanusHelper({ 
      // debug: true,
      server: 'wss://172.16.1.48:8989/',
      roomId: 2233,
      initSuccess: () => {
        console.log('out sucess');
      },
      initError: (error) => {
    
      },
      attachCallbacks: {
        onlocalstream: (stream) => { 
          console.log('local input', stream.toURL()); 
          this.setState({ localStream: stream.toURL() });
        },
        onremotestream: (remoteList) => {
          console.log('on remote list change', remoteList);
          this.setState({ remoteList });
        }
      },
    },{
      name: 'louis-mobile',
      id: 9999,
    });
  }
  componentWillUnmount() {
    this.janus.destroy();
  }

  render(){
    console.log(this.state.localStream);
    return (
      <View style={styles.container}>
        {this.state.remoteList && Object.keys(this.state.remoteList).map((key, index) => {
            return <RTCView key={Math.floor(Math.random() * 1000)} streamURL={this.state.remoteList[key]} style={styles.remoteView}/>
          })
        }
        { this.state.localStream && <RTCView streamURL={this.state.localStream} style={styles.selfView}/>}
      </View>
    )
  }
}

export default Main;