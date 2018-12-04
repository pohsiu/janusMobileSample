import {
  Alert
} from 'react-native';

import Janus from './janus.mobile.js';
let sfutest = null;
let started = false;
let remoteList = {};
let mypvtid = null;

class JanusHelper {
  constructor(config, userInfo) {
    this.config = config;
    this.roomId = config.roomId;
    this.userInfo = userInfo;
    Janus.init({
      debug: "all",
      callback: () => {
        console.log('=== init success ===');
        this.newJanus();
      }
    });
    
  }

  newJanus = () => {
    this.janus = new Janus(
      {
        server: this.config.server,
        success: () => {
          console.log('=== new janus success ===');
          if(this.config.initSuccess) {
            this.config.initSuccess();
          }
          this.attachPlugin();
        },
        error: (error) => {
          console.log('=== new janus failed ===', error);
          if(this.config.initError) {
            this.config.initError(error);
          }
        },
        destroyed: () => {
          Alert.alert("  Success for End Call ");
        }
      }
    );
  }
  checkPropertyAndWork = (msg, property) => {
    const value = msg[property];
    if (value && value !== null) {
      switch (property) {
        case "publishers": {
          console.log("[Janus] Got a list of available publishers/feeds:", value);
          for(let f in value) {
            const { id, display, audio_codec, video_codec } = value[f];
            console.log('haha',id);
            this.newRemoteFeed(id, display, audio_codec, video_codec);
          }
          return;
        }
        case "leaving": {
          console.log("[Janus] Publisher left: " + value);
          const numLeaving = value;
          if (remoteList.hasOwnProperty(numLeaving)) {
            delete remoteList[numLeaving];
            this.config.attachCallbacks.onremotestream(remoteList);
          }
          return;
        }
        case "unpublished": {
          // One of the publishers has unpublished?
          console.log("[Janus] unPublisher left: " + value);
          if(value === 'ok') {
            // That's us
            sfutest.hangup();
            return;
          }
          const numLeaving = value;
          if (remoteList.hasOwnProperty(numLeaving)) {
            delete remoteList[numLeaving];
            this.config.attachCallbacks.onremotestream(remoteList);
          }
          return;
        }
        case "error": {
          if(msg.error_code === 426) {
            // This is a "no such room" error: give a more meaningful description
            sfutest.send({ "message": {
              "request" : "create",
              "room" : this.roomId,
              "notify_joining": true,
              "bitrate": 128000,
              },
              error: (error) => console.log('er', error),
            });
          } else {
            console.log("Error", msg["error"]);
          }
          return;
        }
        default : {
          return;
        }
      }
    }
  }
  attachPlugin = () => {
    console.log('attaching');
    const { 
      success = () => {},
      errorCallback = () => {},
      consentDialog = () => {},
      mediaState = () => {},
      webrtcState = () => {},
      onmessage = () => {},
      onlocalstream = () => {},
      onremotestream = () => {},
      oncleanup = () => {},
    } = this.config.attachCallbacks;

    this.janus.attach({
      plugin: "janus.plugin.videoroom",
      success: (pluginHandle) => {
        console.log('join', pluginHandle);
        sfutest = pluginHandle;
        const register = { 
          "request": "join",
          "room": this.roomId,
          "ptype": "publisher",
          "display": this.userInfo.name,
        };
        sfutest.send({"message": register});
        success(pluginHandle);
      },
      error: (error) => {
        Alert.alert("  -- Error attaching plugin...", error);
        errorCallback(error);
      },
      consentDialog: (on) => {
        consentDialog(on);
      },
      mediaState: (medium, on) => {
        mediaState(medium, on);
      },
      webrtcState: (on) => {
        webrtcState(on);
      },
      onmessage: (msg, jsep) => {
        const event = msg["videoroom"];
        console.log("[Janus] ::: Got a message (publisher) :::", msg, event);
        let myid;
        if(event !== undefined && event !== null) {
          switch(event) {
            case 'joined': {
              myid = msg["id"];
              mypvtid = msg["private_id"];
              console.log("[Janus] Successfully joined room " + msg["room"] + " with ID " + myid);
              this.publishOwnFeed(true);
              this.checkPropertyAndWork(msg, "publishers");
              break;
            }
            case 'event': {
              this.checkPropertyAndWork(msg, "publishers"); // if publishers property exists then work
              this.checkPropertyAndWork(msg, "leaving");    
              this.checkPropertyAndWork(msg, "unpublished");
              this.checkPropertyAndWork(msg, "error");
              break;
            }
            case 'destroyed': {
              Janus.warn("The room has been destroyed!");
              break;
            }
            default: {
              return;
            }
          }
        }
        if(jsep && jsep !== null) {
          sfutest.handleRemoteJsep({jsep: jsep});
        }
        onmessage(msg, jsep);
      },
      onlocalstream: (stream) => {
        onlocalstream(stream);
      },
      onremotestream: (stream) => {
        // The publisher stream is sendonly, we don't expect anything here
        onremotestream(stream);
      },
      oncleanup: () => {
        console.log("[Janus] ::: Got a cleanup notification: we are unpublished now :::");
        oncleanup();
      }
    })
  }

  switchVideoType = () => {
    sfutest.changeLocalCamera();
  }

  toggleAudioMute = () => {
    let muted = sfutest.isAudioMuted();
    if(muted){
      sfutest.unmuteAudio();
    }else{
      sfutest.muteAudio();
    }
  }

  toggleVideoMute = () => {
    let muted = sfutest.isVideoMuted();
    if(muted){
      sfutest.unmuteVideo();
    }else{
      sfutest.muteVideo();
    }
  }

  toggleSpeaker = () => {
    // if(this.state.speaker){
    //   this.setState({speaker: false});
    //   InCallManager.setForceSpeakerphoneOn(false)
    // }else{
    //   this.setState({speaker: true});
    //   InCallManager.setForceSpeakerphoneOn(true)
    // }
  }

  endCall = () => {
    this.janus.destroy();
  }
    
  publishOwnFeed = (useAudio) => {

    sfutest.createOffer(
      {
        media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true},
        success: (jsep) => {
          var publish = { "request": "configure", "audio": useAudio, "video": true };
          sfutest.send({"message": publish, "jsep": jsep});
        },
        error: (error) => {
          Alert.alert("WebRTC error:", error);
          if (useAudio) {
              this.publishOwnFeed(false);
          } else {
          }
        }
      });
  }

  newRemoteFeed = (id, display) => {
    let remoteFeed = null;
    this.janus.attach(
      {
        plugin: "janus.plugin.videoroom",
        success: (pluginHandle) => {
            remoteFeed = pluginHandle;
            // let listen = { "request": "join", "room": this.roomId, "ptype": "listener", "feed": id };
            // remoteFeed.send({"message": listen});
            const subscribe = { "request": "join", "room": this.roomId, "ptype": "subscriber", "feed": id, "private_id": mypvtid };
            remoteFeed.send({"message": subscribe});
        },
        error: (error) => {
            Alert.alert("  -- Error attaching plugin...", error);
        },
        onmessage: (msg, jsep) => {
            let event = msg["videoroom"];
            if(event != undefined && event != null) {
              if(event === "attached") {
                  // Subscriber created and attached
              }
            }
            if(jsep !== undefined && jsep !== null) {
              remoteFeed.createAnswer(
                {
                  jsep: jsep,
                  media: { audioSend: false, videoSend: false },
                  success: (jsep) => {
                      var body = { "request": "start", "room": this.roomId };
                      remoteFeed.send({"message": body, "jsep": jsep});
                  },
                  error: (error) => {
                    Alert.alert("WebRTC error:", error)
                  } 
                });
            }
        },
        webrtcState: (on) => {
        },
        onlocalstream: (stream) => {
        },
        onremotestream: (stream) => {
          console.log('remote join')
          remoteList[id] = stream.toURL();
          this.config.attachCallbacks.onremotestream(remoteList);
        },
        oncleanup: () => {
        }
      });
  }
};

export default JanusHelper;

