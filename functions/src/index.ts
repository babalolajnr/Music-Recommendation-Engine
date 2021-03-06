import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as Papa from "papaparse";
import * as fs from "fs";
import { Song } from "../src/models";
import { knn } from "./knn";
import * as path from "path";
import * as os from "os";
import { getAvgSong } from "./getAvgSong"
import { getSongsListenedTo } from "./getSongsListenedTo";
import { naiveBayes } from "./naiveBayes";
admin.initializeApp();
const db = admin.firestore();

export const getRecommendations = functions.https.onCall(
  async (data, context) => {
    const userId: string | undefined = context.auth?.uid;
    // console.log(`user uid: ${context.auth?.uid}`);
    if (!userId) throw Error(`Invalid authentication`)

    const storage = admin.storage();
    const bucket = storage.bucket("gs://road-trax-test.appspot.com");
    const tempFilePath = path.join(os.tmpdir(), "spotifyFeatures3.csv");
    await bucket
      .file("spotifyFeatures3.csv")
      .download({ destination: tempFilePath });
    // console.log("Downloaded to: " + tempFilePath);

    let results = Papa.parse(fs.readFileSync(tempFilePath, "utf8"));
    // console.log(results.data.slice(1, 10));

    const songsRaw: String[][] = results.data.slice(1);
    const features: String[] = results.data[0];


    const userDoc: FirebaseFirestore.DocumentSnapshot = await db
      .collection("users")
      .doc(userId)
      .get();

    const userData: FirebaseFirestore.DocumentData | undefined = userDoc.data();
    if (!userData) {
      throw Error(`No data for user: ${userId}`);
    }




    const songs: Song[] = [];
    for (let i: number = 0; i < songsRaw.length; i++) {
      let songData: String[] = songsRaw[i];
      const song: Song = {
        genre: songData[features.indexOf("genre")],
        artist: songData[features.indexOf("artist_name")],
        name: songData[features.indexOf("track_name")],
        uid: songData[features.indexOf("track_id")],
        popularity: Number(songData[features.indexOf("popularity")]),
        acousticness: Number(songData[features.indexOf("acousticness")]),
        danceability: Number(songData[features.indexOf("danceability")]),
        duration: Number(songData[features.indexOf("duration_ms")]),
        energy: Number(songData[features.indexOf("energy")]),
        instrumentalness: Number(
          songData[features.indexOf("instrumentalness")]
        ),
        key: songData[features.indexOf("key")],
        liveness: Number(songData[features.indexOf("liveness")]),
        loudness: Number(songData[features.indexOf("loudness")]),
        mode: songData[features.indexOf("mode")],
        speechiness: Number(songData[features.indexOf("speechiness")]),
        tempo: Number(songData[features.indexOf("tempo")]),
        timeStamp: songData[features.indexOf("time_signature")],
        valence: Number(songData[features.indexOf("valence")])
      } as Song;
      songs.push(song);
    }


    const listenHistory: any = userData.listenHistory;
    // for (let key in listenHistory) {
    //    console.log(`HISTORY: ${key}:${listenHistory[key]}`)
    // }
    const songsListenedTo: Song[] = getSongsListenedTo(listenHistory, songs);

    const avgUserSong: Song = getAvgSong(songsListenedTo);


    // console.log(`User avg: acousticness: ${avgUserSong.acousticness},
    // danceability: ${avgUserSong.danceability},
    // popularity: ${avgUserSong.popularity},
    // valence: ${avgUserSong.valence},
    // energy: ${avgUserSong.energy},
    // liveness: ${avgUserSong.liveness},
    // speechiness: ${avgUserSong.speechiness},
    // timeStamp: ${avgUserSong.timeStamp},
    // instrumentalness: ${avgUserSong.instrumentalness},
    // loudness: ${avgUserSong.loudness},
    // tempo: ${avgUserSong.tempo}`);


    const knnResult: Song[] = knn(songs, avgUserSong);  //returns 20 sorted songs
    // console.log(`KNN top Result: ${knnResult[0].artist} - ${knnResult[0].name}`);
    // console.log(`KNN second Result: ${knnResult[1].artist} - ${knnResult[1].name}`);
    // console.log(`KNN 7th Result: ${knnResult[6].artist} - ${knnResult[1].name}`);

    const nbResult: Song[] = naiveBayes(songsListenedTo, knnResult) //returns 10 sorted songs
    return Promise.resolve({ body: nbResult });
  }
);
