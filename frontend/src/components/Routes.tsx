
import { RouterProvider,createBrowserRouter} from "react-router";
import App from "../App";
import About from "../pages/About";
import CallJoinForm from "../pages/CallJoinForm";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Call from "../pages/Call";
import Thankyou from "../pages/Thankyou";
import Dashboard from "../pages/Dashboard";
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/about',
    element: <About />,
  },
  {
    path: '/join',
    element: <CallJoinForm />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Signup />,
  },
  {
    path: '/call',
    element: <Call />,
  },
  {
    path: '/thankyou',
    element:<Thankyou/>,
  },
  {
    path:"/dashboard",
    element:<Dashboard/>,
  }
]);
function Routes() {
  return <RouterProvider router={router} />;
}

export default Routes