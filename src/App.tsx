// @ts-nocheck

import "regenerator-runtime/runtime";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { FileUploader } from "react-drag-drop-files";
import UploadSvg from "./assets/lol.svg?react";
import MicroOn from "./assets/micro-on.svg?react";
import MicroOff from "./assets/micro-off.svg?react";
import { useForm } from "react-hook-form";
import example_disconnection from "./assets/example_disconnection.mp4";
import { ToastContainer, toast } from "react-toastify";

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

// Configuration
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const web3Connection = new Connection(RPC_ENDPOINT, "confirmed");

const Dictaphone: React.FC<{ triggerFormSubmit: () => void }> = ({ triggerFormSubmit }) => {
    const [trumpDetected, setTrumpDetected] = useState(false);
    const { transcript, browserSupportsSpeechRecognition, isMicrophoneAvailable } = useSpeechRecognition({
        commands: [{ command: /.*Say Trump.*/, callback: () => handleTrumpDetected() }],
    });

    if (!browserSupportsSpeechRecognition) {
        toast("Browser doesn't support speech recognition.", {
            closeButton: true,
            style: { backgroundColor: "red", color: "white", height: "200px" },
            progress: 0,
        });
    }

    if (!isMicrophoneAvailable) {
        toast("Please allow microphone access to use this feature.", {
            closeButton: true,
            style: { backgroundColor: "red", color: "white", height: "200px" },
            progress: 0,
        });
    }

    const handleTrumpDetected = async () => {
        setTrumpDetected(true);
        await new Promise((resolve) => setTimeout(resolve, 600));
        triggerFormSubmit();
    };

    return (
        <div className="flex flex-col gap-3 items-center justify-center">
            To create your coin click on start then say Trump in your sentence:
            <div className="flex flex-row gap-2">
                <button
                    className="bg-black border border-white text-white px-4 py-2 rounded-md"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        SpeechRecognition.startListening({ language: "en-US" });
                    }}
                >
                    Start
                </button>
                <button
                    className="bg-black border border-white text-white px-4 py-2 rounded-md"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        SpeechRecognition.stopListening();
                    }}
                >
                    Stop
                </button>
            </div>
            <p className={trumpDetected ? "text-green-500" : ""}>{transcript}</p>
        </div>
    );
};

interface IFormInput {
    name: string;
    symbol: string;
    description: string;
    file: File | null;
    telegram: string | undefined;
    website: string | undefined;
    twitter: string | undefined;
}

const Form: React.FC<{
    walletAddress: string | null;
}> = ({ walletAddress }) => {
    const [file, setFile] = useState<File | null>(null);

    // Utilisation du mode 'onChange' pour valider à chaque changement
    const {
        register,
        setValue,
        handleSubmit,
        watch,
        formState: { errors },
        resetField,
        getValues,
    } = useForm<IFormInput>({
        mode: "onChange", // Validation on each change
    });

    const watchedFields = watch(["name", "symbol", "description"]);

    const isFormValid = () => {
        return Object.keys(errors).length === 0 && watchedFields.every((field) => field);
    };
    const [transcriptValue, setTranscript] = useState("");
    const [trumpDetected, setTrumpDetected] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { transcript, listening, browserSupportsSpeechRecognition, isMicrophoneAvailable } = useSpeechRecognition({
        commands: [
            {
                command: /.*Trump.*/,
                callback: () => {
                    handleTrumpDetected();
                },
            },
        ],
    });
    console.log(getValues("description"));
    useEffect(() => {
        setTranscript(transcript);
    }, [transcript]);

    const handleTrumpDetected = async () => {
        setTrumpDetected(true);
    };

    // Fonction pour envoyer la transaction de création de token
    const sendCreateTx = async () => {
        if (!walletAddress) {
            alert("Please fill in all fields and connect your wallet.");
            return;
        }

        try {
            // setIsSubmitting(true);

            // Generate a random keypair for mint
            const mintKeypair = Keypair.generate();

            // Create form data with metadata
            const formData = new FormData();

            // Example optional metadata
            for (const [key, value] of Object.entries(getValues())) {
                if (value) {
                    formData.append(key, value);
                }
            }
            if (file) {
                formData.append("file", file);
            }
            // Send metadata to the server (e.g., upload to IPFS)
            const metadataResponse = await fetch("/api/ipfs", {
                method: "POST",
                body: formData,
            });
            const metadataResponseJSON = await metadataResponse.json();
            // Create token on the server
            const response = await fetch("https://pumpportal.fun/api/trade-local", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    publicKey: walletAddress,
                    action: "create",
                    tokenMetadata: {
                        name: metadataResponseJSON.metadata.name,
                        symbol: metadataResponseJSON.metadata.symbol,
                        uri: metadataResponseJSON.metadataUri,
                    },
                    mint: mintKeypair.publicKey.toBase58(),
                    denominatedInSol: "true",
                    amount: 0,
                    slippage: 10,
                    priorityFee: 0.0,
                    pool: "pump",
                }),
            });
            if (response.status === 200) {
                const data = await response.arrayBuffer();
                const tx = VersionedTransaction.deserialize(new Uint8Array(data));

                // Get the wallet public key from Phantom and sign the transaction
                const { signature } = await window.solana.signTransaction(tx);

                tx.addSignature(window.solana.publicKey, signature); // Ajoute la signature à la transaction

                // Send the transaction to the network
                const txSignature = await web3Connection.sendRawTransaction(tx.serialize());

                console.log("Transaction: https://solscan.io/tx/" + txSignature);
                alert("Transaction sent successfully!");
            } else {
                console.log(response.statusText);
                alert("Failed to create token.");
            }
        } catch (err) {
            console.error("Error sending transaction:", err);
            alert("An error occurred while creating the token.");
        }
    };
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (transcriptValue !== "") {
            setValue("description", transcriptValue);
            if (!listening && !getValues("description").includes("Trump")) {
                setIsOpen(true);
                setTranscript("");
            }
        }
    }, [transcript, listening]);

    const triggerFormSubmit = () => {
        formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };

    return (
        <form className="flex flex-col" onSubmit={handleSubmit(sendCreateTx)} ref={formRef}>
            <div className="flex gap-[40px] max-w-[900px]">
                <div className="flex flex-col gap-3">
                    <div className="text-white">
                        <p>Your coin information:</p>
                        <small className="text-gray-500">* This information will be used to create your coin.</small>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-start">
                            <label htmlFor="name" className="text-white mb-2">
                                Name
                            </label>
                        </div>
                        <input
                            {...register("name", {
                                value: "",
                                required: "Name is required",
                                maxLength: { value: 20, message: "Max length is 20" },
                                minLength: { value: 1, message: "Name is required" },
                            })}
                            id="name"
                            maxLength={20}
                            minLength={1}
                            name="name"
                            type="text"
                            placeholder="The name of your new coin"
                            className="w-full border border-white placeholder-gray-500"
                        />
                        {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-start">
                            <label htmlFor="symbol" className="text-white mb-2">
                                Ticker
                            </label>
                        </div>
                        <input
                            {...register("symbol", {
                                value: "",
                                required: "Ticker is required",
                                maxLength: { value: 10, message: "Max length is 10" },
                                minLength: { value: 1, message: "symbol is required" },
                            })}
                            maxLength={10}
                            minLength={1}
                            name="symbol"
                            type="text"
                            placeholder="The Ticker of your new coin"
                            className="w-full border border-white placeholder-gray-500"
                        />
                        {errors.symbol && <span className="text-red-500 text-sm">{errors.symbol.message}</span>}
                    </div>
                    <div className="flex flex-col mb-3">
                        <div className="flex justify-start">
                            <label htmlFor="file" className="text-white mb-2">
                                Image or video
                            </label>
                        </div>
                        <FileUploader
                            handleChange={(e: File) => {
                                setFile(e);
                                setValue("file", e);
                            }}
                            {...register("file", { required: false })}
                            multiple={false}
                            name="file"
                            types={["JPG", "PNG", "GIF"]}
                            required={false}
                            classes="w-full border border-white rounded-md border-dashed border-[2px]"
                            maxSize={2}
                            dropMessageStyle={{ backgroundColor: "grey" }}
                            children={
                                <div className="text-gray-500 p-[10px] text-center cursor-pointer flex flex-col items-center justify-center gap-2 py-3 h-[250px]">
                                    {file ? (
                                        <>
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="Uploaded"
                                                className="w-full  object-contain h-[180px]"
                                            />
                                            <button className="bg-black border border-white text-white px-4 py-2 rounded-md">
                                                Change file
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <UploadSvg height={40} width={40} fill="white" />
                                            <span>Drag and drop your image here, or click to select</span>
                                        </>
                                    )}
                                </div>
                            }
                        />
                    </div>
                    <div className="flex flex-col ">
                        <div className="flex justify-start items-center gap-2">
                            <label htmlFor="description" className="text-white mb-2">
                                Description
                            </label>
                        </div>
                        <div className="relative w-full h-full">
                            <textarea
                                disabled={true}
                                {...register("description", {
                                    required: "Description is required",
                                    maxLength: { value: 100, message: "Max length is 100" },
                                    minLength: { value: 1, message: "Description is required" },
                                })}
                                value={getValues("description")}
                                maxLength={100}
                                minLength={1}
                                name="description"
                                placeholder="Click here to start the audio description of your new coin, dont forget to say Trump"
                                className="w-full border border-white h-[100px] placeholder-gray-500 relative"
                            ></textarea>

                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                {!listening ? (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            SpeechRecognition.startListening({
                                                language: navigator.language,
                                                continuous: true,
                                            });
                                        }}
                                        className="bg-black border-2 border-white text-white px-4 py-2 rounded-full"
                                    >
                                        <MicroOff height={40} width={40} fill="white" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            SpeechRecognition.stopListening();
                                        }}
                                        className="bg-black border-2 border-white text-white px-4 py-2 rounded-full"
                                    >
                                        <MicroOn height={40} width={40} fill="white" />
                                    </button>
                                )}
                            </div>
                        </div>
                        {errors.description && (
                            <span className="text-red-500 text-sm">{errors.description.message}</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="text-white">
                        <p>Additional information about the coin:</p>
                        <small className="text-gray-500">
                            * Please note that you will not be able to modify this information later.
                        </small>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-start">
                            <label htmlFor="telegram" className="text-white mb-2">
                                Telegram link
                            </label>
                            <small className="text-gray-500">* Optional</small>
                        </div>
                        <input
                            {...register("telegram")}
                            name="telegram"
                            type="text"
                            placeholder="The telegram link of your new coin"
                            className="w-full border border-white placeholder-gray-500"
                        />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-start">
                            <label htmlFor="website" className="text-white mb-2">
                                Website link
                            </label>
                            <small className="text-gray-500">* Optional</small>
                        </div>
                        <input
                            {...register("website")}
                            name="website"
                            type="text"
                            placeholder="The website link of your new coin"
                            className="w-full border border-white placeholder-gray-500"
                        />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-start">
                            <label htmlFor="twitter" className="text-white mb-2">
                                Twitter or X link
                            </label>
                            <small className="text-gray-500">* Optional</small>
                        </div>
                        <input
                            {...register("twitter")}
                            name="twitter"
                            type="text"
                            placeholder="The twitter or X link of your new coin"
                            className="w-full border border-white placeholder-gray-500"
                        />
                    </div>
                </div>
            </div>
            <Dialog open={isOpen} onClose={() => setIsOpen(false)} className=" relative z-50">
                <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                    <DialogPanel className="bg-black max-w-lg space-y-4 flex flex-col justify-center items-center border-4 border-white rounded-md p-12 text-white">
                        <DialogTitle className="font-bold text-red-500">Oops, you didn't say Trump 🙂‍↕️</DialogTitle>
                        <Description>You need to say Trump in your description to create your coin bro...</Description>
                        <button
                            className="bg-black border border-green-500 text-green-500 px-4 py-2 rounded-md"
                            onClick={() => {
                                setIsOpen(false);
                                resetField("description");
                            }}
                        >
                            Ok i get it !
                        </button>
                    </DialogPanel>
                </div>
            </Dialog>
        </form>
    );
};

const ConnectWalletButton: React.FC<{
    setWalletAddress: (walletAddress: string | null) => void;
    walletAddress: string | null;
}> = ({ walletAddress, setWalletAddress }) => {
    const [isOpen, setIsOpen] = useState(false);

    const connectWallet = async () => {
        if (window.solana && window.solana.isPhantom) {
            try {
                const response = await window.solana.connect();
                setWalletAddress(response.publicKey.toString());
            } catch (err) {
                toast("Error during connection", {
                    autoClose: 1000,
                    closeButton: true,
                    style: { backgroundColor: "red", color: "white" },
                });
            }
        } else {
            toast("Please install Phantom wallet!", {
                autoClose: 1000,
                closeButton: true,
                style: { backgroundColor: "red", color: "white" },
            });
        }
        setIsOpen(false);
    };

    const disconnectWallet = () => {
        setWalletAddress(null);
    };
    const handleOpenDialog = () => {
        setIsOpen(true);
    };
    return (
        <button
            className="bg-black border border-white text-white px-4 py-2 rounded-md"
            onClick={!walletAddress ? handleOpenDialog : disconnectWallet}
        >
            <Dialog open={isOpen} onClose={() => setIsOpen(false)} className=" relative z-50">
                <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                    <DialogPanel className="bg-black max-w-lg space-y-4 flex flex-col justify-center items-center border-4 border-white rounded-md p-12 text-green-500">
                        <DialogTitle className="font-bold">Connect your Phantom wallet</DialogTitle>
                        <Description>
                            This will connect your Phantom wallet to the SayTrump app. If you dont you wont be able to
                            create your token.
                        </Description>
                        <Description>
                            Be careful when connecting your wallet to an application; make sure to disconnect once
                            you're done. Follow the steps in the video below to disconnect properly.
                        </Description>
                        <video src={example_disconnection} controls={true} className="w-[200px]"></video>
                        <p></p>
                        <div className="flex gap-4">
                            <button
                                className="bg-black border border-red-500 text-red-500 px-4 py-2 rounded-md"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-black border border-green-500 text-green-500 px-4 py-2 rounded-md"
                                onClick={() => connectWallet()}
                            >
                                Connect your wallet
                            </button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
            {!walletAddress ? <span>Connect your Phantom wallet</span> : <span>Disconnect your wallet</span>}
        </button>
    );
};

function App() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    return (
        <section className="w-full flex flex-col items-center justify-center gap-4">
            <header className="flex flex-row justify-between items-center w-full py-4 border-b border-white h-[80px] px-4">
                <span className="flex-1 text-white">
                    {walletAddress ? `[${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}]` : ""}
                </span>
                <h1 className="text-4xl font-bold flex-1 text-center text-green-500">!!! $SayTrump !!!</h1>
                <div className="flex-1 flex justify-end">
                    <div className="flex flex-row gap-2">
                        <ConnectWalletButton setWalletAddress={setWalletAddress} walletAddress={walletAddress} />
                    </div>
                </div>
            </header>
            <section className="flex flex-col items-center justify-center w-full border-b border-white py-4 pb-8">
                <div className=" text-white text-center w-1/2">
                    <h3 className="text-2xl font-bold text-yellow-500">
                        Create a cryptocurrency with just your voice, as long as you say Trump
                    </h3>
                    <br />
                    <h3 className="text-2xl font-bold ">
                        Trump? Did someone say Trump? I feel like I'm hearing Trump everywhere!
                    </h3>
                    <br />
                    <p>
                        This web app is for all the people who love saying Trump—it lets you create your token in the
                        best way possible: by saying Trump. Connect your wallet, then fill in the necessary information
                        to create your cryptocurrency.
                        <br />
                        Describe your cryptocurrency orally, and it must include the word Trump; otherwise, the prompt
                        will not be valid. Finally, validate by saying the passphrase 'SayTrump,' and voilà, you have
                        deployed your cryptocurrency on PumpFun 🎉!
                    </p>
                    <br />
                    <br />
                    <h2 className="text-2xl font-bold text-green-500">
                        I want to see your most creative descriptions, guys—let's have fun with this, the ticker is
                        $SAYTRUMP!
                    </h2>
                </div>
            </section>
            <section className="flex items-center justify-center w-full border-b border-white py-4">
                <Form walletAddress={walletAddress} />
            </section>
            <section className="flex items-center justify-center w-full border-b border-white py-4 text-center">
                I'm also providing a GitHub repository so you can verify the code is legit. I'm not here to scam anyone.{" "}
                <br />
                I’m only putting $50 into the token—you handle the rest!! <br /> Long live $SayTrump!!
            </section>
            <ToastContainer />
        </section>
    );
}

export default App;
